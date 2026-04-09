// ============================================
// Database Types for Scrum Dashboard
// ============================================

// Enums
export type SystemRole = 'admin' | 'user';
export type ProjectRole = 'product_owner' | 'scrum_master' | 'developer';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type StoryStatus = 'backlog' | 'ready' | 'in_progress' | 'done';
export type TaskStatus = 'unassigned' | 'assigned' | 'in_progress' | 'completed';
export type Priority = 'must_have' | 'should_have' | 'could_have' | 'wont_have';

// Database Tables
export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  system_role: SystemRole;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  status: "active" | "on_hold" | "completed";
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  velocity: number | null;
  created_at: string;
}

export interface UserStory {
  id: string;
  project_id: string;
  sprint_id: string | null;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  priority: Priority;
  story_points: number | null;
  status: StoryStatus;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  business_value: number | null;
  unfinished_sprint_info?: {
    sprint_name: string;
    days_ago: number;
  };
}

export interface Task {
  id: string;
  user_story_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  is_accepted: boolean;
  is_active: boolean;
  active_since: string | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  description: string | null;
  logged_at: string;
}

// Extended types (with relations)
export interface ProjectWithMembers extends Project {
  members: (ProjectMember & { user: User })[];
}

export interface UserStoryWithTasks extends UserStory {
  tasks: Task[];
}

export interface TaskWithAssignee extends Task {
  assignee: User | null;
}