import type { Center } from "./center";

export type UserCenter = Center & {
  is_main_center?: boolean;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
};
