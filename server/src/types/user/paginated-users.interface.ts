import { UserSelectModel } from '../../database/schema/tables/user.table';

// Extended user type with centers for pagination response
export interface UserWithCenters extends UserSelectModel {
  centers?: Array<{
    id_center: number;
    center_name: string;
    id_company: number;
    company_name: string;
    is_main_center?: boolean;
    start_date?: string | Date | null;
    end_date?: string | Date | null;
  }>;
  main_center?: {
    id_center: number;
    center_name: string;
    id_company: number;
    company_name: string;
    is_main_center?: boolean;
    start_date?: string | Date | null;
    end_date?: string | Date | null;
  } | null; // For backward compatibility
}

export interface PaginatedUsersResult {
  data: UserWithCenters[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}