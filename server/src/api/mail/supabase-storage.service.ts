import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;
  private readonly allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  private readonly maxSizeBytes = 5 * 1024 * 1024;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET;

    if (!supabaseUrl) {
      throw new InternalServerErrorException('SUPABASE_URL is not configured');
    }
    if (!supabaseServiceRoleKey) {
      throw new InternalServerErrorException('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    if (!supabaseBucket) {
      throw new InternalServerErrorException('SUPABASE_STORAGE_BUCKET is not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.bucket = supabaseBucket;
  }

  async uploadMailTemplateImage(file: Express.Multer.File): Promise<{ path: string; publicUrl: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: png, jpg, webp, gif');
    }

    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException('Image exceeds maximum size of 5MB');
    }

    const ext = this.getExtension(file);
    const filePath = `mail-templates/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new InternalServerErrorException(`Error uploading image to Supabase: ${uploadError.message}`);
    }

    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new InternalServerErrorException('Could not generate public URL for uploaded image');
    }

    return {
      path: filePath,
      publicUrl: data.publicUrl,
    };
  }

  private getExtension(file: Express.Multer.File): string {
    if (file.mimetype === 'image/png') return 'png';
    if (file.mimetype === 'image/jpeg') return 'jpg';
    if (file.mimetype === 'image/webp') return 'webp';
    if (file.mimetype === 'image/gif') return 'gif';
    return 'bin';
  }
}
