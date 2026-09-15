import { Injectable, NotFoundException } from "@nestjs/common";
import { CourseCategoryRepository } from "src/database/repository/course/course-category.repository";
import { CreateCourseCategoryDto } from "./dto/create-course-category.dto";
import { UpdateCourseCategoryDto } from "./dto/update-course-category.dto";

@Injectable()
export class CourseCategoryService {
  constructor(private readonly courseCategoryRepository: CourseCategoryRepository) {}

  async create(dto: CreateCourseCategoryDto) {
    return this.courseCategoryRepository.create(dto);
  }

  async findAll() {
    return this.courseCategoryRepository.findAll();
  }

  async findById(id_category: number) {
    const category = await this.courseCategoryRepository.findById(id_category);
    if (!category) throw new NotFoundException("Categoría de curso no encontrada");
    return category;
  }

  async update(id_category: number, dto: UpdateCourseCategoryDto) {
    await this.findById(id_category);
    return this.courseCategoryRepository.update(id_category, dto);
  }
}
