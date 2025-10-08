import { Injectable, Inject } from '@nestjs/common';
import { distance } from 'fastest-levenshtein';
import { UserRepository } from '../../../database/repository/user/user.repository';
import { MoodleUserRepository } from '../../../database/repository/moodle-user/moodle-user.repository';
import { MoodleService } from '../../moodle/moodle.service';
import { DATABASE_PROVIDER } from '../../../database/database.module';
import { DatabaseService } from '../../../database/database.service';
import { QueryOptions } from '../../../database/repository/repository';
import { MoodleUser } from '../../../types/moodle/user';
import { UserSelectModel } from '../../../database/schema/tables/user.table';

export interface UserMatch {
  bdUser: UserSelectModel;
  moodleUser: MoodleUser;
  matchType: 'exact_dni' | 'email_and_name' | 'email_only' | 'name_only';
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface LinkedUserPair {
  bdUser: UserSelectModel;
  moodleUser: MoodleUser;
  linkedAt?: string;
}

export interface UserComparison {
  exactMatches: UserMatch[];      // Coincidencias por DNI
  probableMatches: UserMatch[];   // Coincidencias dudosas (email, nombre + apellidos)
  linkedUsers: LinkedUserPair[];  // Usuarios ya vinculados
  unmatched: {
    bdUsers: UserSelectModel[];
    moodleUsers: MoodleUser[];
  };
}

@Injectable()
export class UserComparisonService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly moodleUserRepository: MoodleUserRepository,
    private readonly moodleService: MoodleService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Extrae el DNI de los campos personalizados de un usuario de Moodle
   */
  private getMoodleDNI(moodleUser: MoodleUser): string | null {
    if (!moodleUser.customfields) return null;
    
    // Buscar campo DNI en customfields
    const dniField = moodleUser.customfields.find(field => 
      field.shortname?.toLowerCase() === 'dni' || 
      field.name?.toLowerCase() === 'dni' ||
      field.shortname?.toLowerCase().includes('dni') ||
      field.name?.toLowerCase().includes('documento')
    );
    
    return dniField?.value?.trim() || null;
  }

  /**
   * Compara usuarios de BD con usuarios de Moodle y los clasifica por tipo de coincidencia
   */
  async compareUsers(options?: QueryOptions): Promise<UserComparison> {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Obtener todos los usuarios de BD
      const bdUsers = await this.userRepository.findAll({}, { transaction });
      
      // Obtener todos los usuarios de Moodle
      const moodleUsers = await this.moodleService.getAllUsers();
      
      // Obtener usuarios ya vinculados
      const linkedUsers = await this.moodleUserRepository.findAll({}, { transaction });
      const linkedMoodleIds = new Set(linkedUsers.map(lu => lu.moodle_id));
      // CAMBIO: No excluir usuarios de BD que ya tienen vinculaciones, 
      // pueden tener múltiples usuarios Moodle asociados
      
      // Filtrar solo usuarios de Moodle ya vinculados (estos sí son únicos)
      const unlinkedBdUsers = bdUsers; // Incluir todos los usuarios de BD
      const unlinkedMoodleUsers = moodleUsers.filter(user => !linkedMoodleIds.has(user.id));
      
      const exactMatches: UserMatch[] = [];
      const probableMatches: UserMatch[] = [];
      const usedMoodleIds = new Set<number>();



      // 1. Buscar coincidencias exactas por DNI
      for (const bdUser of unlinkedBdUsers) {
        if (!bdUser.dni) {
          continue; // Saltear usuarios sin DNI silenciosamente
        }
        
        // Buscar TODOS los usuarios de Moodle con el mismo DNI que NO estén ya vinculados
        const moodleMatches = unlinkedMoodleUsers.filter(mu => {
          if (usedMoodleIds.has(mu.id)) {
            return false;
          }
          
          const moodleDni = this.getMoodleDNI(mu);
          if (!moodleDni) {
            return false;
          }
          
          // Comparar DNI (normalizado)
          const bdDni = bdUser.dni.replace(/\s+/g, '').toLowerCase();
          const normalizedMoodleDni = moodleDni.replace(/\s+/g, '').toLowerCase();
          
          return bdDni === normalizedMoodleDni;
        });
        
        if (moodleMatches.length > 0) {
          // Procesar TODOS los matches encontrados (no solo el mejor)
          for (const moodleUser of moodleMatches) {
            // Verificar que este usuario Moodle no haya sido usado ya
            if (usedMoodleIds.has(moodleUser.id)) {
              continue;
            }
            
            exactMatches.push({
              bdUser,
              moodleUser,
              matchType: 'exact_dni',
              similarity: 1.0, // DNI exacto siempre es 1.0
              confidence: 'high'
            });
            
            // Marcar este usuario Moodle como usado (pero NO el usuario BD)
            usedMoodleIds.add(moodleUser.id);
          }
        }
      }
      
      // 2. Buscar coincidencias exactas: email coincidente + nombre/apellidos >90% similitud
      for (const bdUser of unlinkedBdUsers) {
        if (!bdUser.email) continue;
        
        const moodleUser = unlinkedMoodleUsers.find(mu => {
          if (usedMoodleIds.has(mu.id) || !mu.email) return false;
          
          // Verificar email coincidente
          const emailMatches = mu.email.toLowerCase() === bdUser.email!.toLowerCase();
          if (!emailMatches) return false;
          
          // Verificar similitud de nombre y apellidos
          const bdFullName = this.normalizeName(`${bdUser.name} ${bdUser.first_surname || ''} ${bdUser.second_surname || ''}`);
          const moodleFullName = this.normalizeName(`${mu.firstname} ${mu.lastname}`);
          const nameSimilarity = this.calculateSimilarity(bdFullName, moodleFullName);
          
          return nameSimilarity >= 0.90;
        });
        
        if (moodleUser) {
          const bdFullName = this.normalizeName(`${bdUser.name} ${bdUser.first_surname || ''} ${bdUser.second_surname || ''}`);
          const moodleFullName = this.normalizeName(`${moodleUser.firstname} ${moodleUser.lastname}`);
          const similarity = this.calculateSimilarity(bdFullName, moodleFullName);
          
          exactMatches.push({
            bdUser,
            moodleUser,
            matchType: 'email_and_name',
            similarity,
            confidence: 'high'
          });
          usedMoodleIds.add(moodleUser.id);
          // NO marcar bdUser como usado, puede tener múltiples matches
        }
      }

      // 3. Buscar coincidencias probables: solo email coincidente (pero nombre <90% similitud)
      for (const bdUser of unlinkedBdUsers) {
        if (!bdUser.email) continue;
        
        const moodleUser = unlinkedMoodleUsers.find(mu => {
          if (usedMoodleIds.has(mu.id) || !mu.email) return false;
          
          // Verificar email coincidente
          const emailMatches = mu.email.toLowerCase() === bdUser.email!.toLowerCase();
          if (!emailMatches) return false;
          
          // Verificar que nombre NO sea suficientemente similar (ya habríamos capturado los >90% antes)
          const bdFullName = this.normalizeName(`${bdUser.name} ${bdUser.first_surname || ''} ${bdUser.second_surname || ''}`);
          const moodleFullName = this.normalizeName(`${mu.firstname} ${mu.lastname}`);
          const nameSimilarity = this.calculateSimilarity(bdFullName, moodleFullName);
          
          return nameSimilarity < 0.90;
        });
        
        if (moodleUser) {
          const bdFullName = this.normalizeName(`${bdUser.name} ${bdUser.first_surname || ''} ${bdUser.second_surname || ''}`);
          const moodleFullName = this.normalizeName(`${moodleUser.firstname} ${moodleUser.lastname}`);
          const similarity = this.calculateSimilarity(bdFullName, moodleFullName);
          
          probableMatches.push({
            bdUser,
            moodleUser,
            matchType: 'email_only',
            similarity,
            confidence: similarity > 0.75 ? 'medium' : 'low'
          });
          usedMoodleIds.add(moodleUser.id);
          // NO marcar bdUser como usado, puede tener múltiples matches
        }
      }

      // 4. Buscar coincidencias probables por nombre y apellidos solamente
      for (const bdUser of unlinkedBdUsers) {
        const bdFullName = this.normalizeName(`${bdUser.name} ${bdUser.first_surname || ''} ${bdUser.second_surname || ''}`);
        
        let bestMatch: { user: MoodleUser; similarity: number } | null = null;
        
        for (const moodleUser of unlinkedMoodleUsers) {
          if (usedMoodleIds.has(moodleUser.id)) continue;
          
          const moodleFullName = this.normalizeName(`${moodleUser.firstname} ${moodleUser.lastname}`);
          const similarity = this.calculateSimilarity(bdFullName, moodleFullName);
          
          if (similarity > 0.75 && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { user: moodleUser, similarity };
          }
        }
        
        if (bestMatch) {
          const matchType = bestMatch.similarity > 0.9 ? 'name_only' : 'name_only';
          const confidence = bestMatch.similarity > 0.9 ? 'high' : bestMatch.similarity > 0.85 ? 'medium' : 'low';
          
          probableMatches.push({
            bdUser,
            moodleUser: bestMatch.user,
            matchType,
            similarity: bestMatch.similarity,
            confidence
          });
          usedMoodleIds.add(bestMatch.user.id);
          // NO marcar bdUser como usado, puede tener múltiples matches
        }
      }

      // 5. Usuarios sin coincidencia
      // Para determinar usuarios BD sin match, necesitamos ver cuáles NO aparecen en ningún match
      const bdUsersWithMatches = new Set([
        ...exactMatches.map(m => m.bdUser.id_user!),
        ...probableMatches.map(m => m.bdUser.id_user!)
      ]);
      
      const unmatchedBdUsers = unlinkedBdUsers.filter(user => !bdUsersWithMatches.has(user.id_user!));
      const unmatchedMoodleUsers = unlinkedMoodleUsers.filter(user => !usedMoodleIds.has(user.id));

      // 6. Obtener usuarios ya vinculados
      const linkedUserPairs: LinkedUserPair[] = [];
      
      for (const linkedUser of linkedUsers) {
        const bdUser = bdUsers.find(user => user.id_user === linkedUser.id_user);
        const moodleUser = moodleUsers.find(user => user.id === linkedUser.moodle_id);
        
        if (bdUser && moodleUser) {
          linkedUserPairs.push({
            bdUser,
            moodleUser,
            linkedAt: linkedUser.createdAt?.toISOString()
          });
        }
      }

      return {
        exactMatches,
        probableMatches,
        linkedUsers: linkedUserPairs,
        unmatched: {
          bdUsers: unmatchedBdUsers,
          moodleUsers: unmatchedMoodleUsers
        }
      };
    });
  }

  /**
   * Normaliza un nombre para comparación (quita acentos, convierte a minúsculas, quita espacios extra)
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/\s+/g, ' ')           // Normalizar espacios
      .trim();
  }

  /**
   * Calcula la similitud entre dos strings usando distancia de Levenshtein normalizada
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    const maxLength = Math.max(str1.length, str2.length);
    const levenshteinDistance = distance(str1, str2);
    
    return 1 - (levenshteinDistance / maxLength);
  }

  /**
   * Vincula un usuario de BD con un usuario de Moodle
   */
  async linkUsers(bdUserId: number, moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Verificar que los usuarios existen
      const bdUser = await this.userRepository.findById(bdUserId, { transaction });
      if (!bdUser) {
        throw new Error(`Usuario de BD con ID ${bdUserId} no encontrado`);
      }

      const moodleUser = await this.moodleService.getUserById(moodleUserId);
      if (!moodleUser) {
        throw new Error(`Usuario de Moodle con ID ${moodleUserId} no encontrado`);
      }

      // Verificar que no estén ya vinculados
      const existingLink = await this.moodleUserRepository.findByMoodleId(moodleUserId, { transaction });
      if (existingLink) {
        throw new Error(`El usuario de Moodle ${moodleUserId} ya está vinculado`);
      }

      // Crear la vinculación
      return await this.moodleUserRepository.create({
        id_user: bdUserId,
        moodle_id: moodleUserId,
        moodle_username: moodleUser.username,
        moodle_password: null
      }, { transaction });
    });
  }

  /**
   * Desvincula un usuario de BD de un usuario de Moodle
   */
  async unlinkUsers(bdUserId: number, moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Buscar la vinculación existente
      const existingLink = await this.moodleUserRepository.findByMoodleId(moodleUserId, { transaction });
      
      if (!existingLink) {
        throw new Error(`No existe vinculación para el usuario de Moodle ${moodleUserId}`);
      }

      // Verificar que la vinculación corresponde al usuario de BD especificado
      if (existingLink.id_user !== bdUserId) {
        throw new Error(`El usuario de Moodle ${moodleUserId} no está vinculado al usuario de BD ${bdUserId}`);
      }

      // Eliminar la vinculación
      await this.moodleUserRepository.delete(existingLink.id_moodle_user!, { transaction });

      return {
        success: true,
        message: `Vinculación eliminada correctamente entre usuario BD ${bdUserId} y Moodle ${moodleUserId}`
      };
    });
  }
}