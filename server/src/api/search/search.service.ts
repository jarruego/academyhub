import { Injectable } from "@nestjs/common";
import { SearchRepository } from "src/database/repository/search/search.repository";

/** Nº máximo de resultados devueltos por categoría (dashboard Home, buscador global). */
const RESULTS_PER_CATEGORY = 5;
/** Por debajo de esto no se consulta la BD — evita escanear todo con un `%a%` de una letra. */
const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  constructor(private readonly repository: SearchRepository) {}

  async search(rawTerm: string) {
    const term = (rawTerm ?? "").trim();
    if (term.length < MIN_QUERY_LENGTH) {
      return { users: [], courses: [], companies: [], centers: [] };
    }

    const [foundUsers, foundCourses, foundCompanies, foundCenters] = await Promise.all([
      this.repository.searchUsers(term, RESULTS_PER_CATEGORY),
      this.repository.searchCourses(term, RESULTS_PER_CATEGORY),
      this.repository.searchCompanies(term, RESULTS_PER_CATEGORY),
      this.repository.searchCenters(term, RESULTS_PER_CATEGORY),
    ]);

    return { users: foundUsers, courses: foundCourses, companies: foundCompanies, centers: foundCenters };
  }
}
