export type MoodleGroup = {
    id: number,
    courseid: number,
    name: string,
    description: string,
    descriptionformat: number,
    enrolmentkey: string,
    idnumber: string,
    timecreated: number,
    timemodified: number
};

// Response item for core_group_create_groups. Moodle usually returns an array of
// created group objects which contain at least an `id` but some installations
// may use `groupid` or `groupidnumber`. Keep optional fields to be tolerant.
export type CreatedGroupResponseItem = {
    id?: number;
    groupid?: number;
    groupidnumber?: number;
    [k: string]: unknown;
};