import { NextRequest } from "next/server";
import { GET } from "@/app/api/stories/[storyId]/tasks/route";

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockGetUser = jest.fn();
const mockFrom = jest.fn<any, any>();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

// ─── Helper functions ─────────────────────────────────────────────────────────
function makeRequest() {
  return new NextRequest("http://localhost/api/stories/story-1/tasks", {
    method: "GET",
  });
}

function makeContext(storyId = "story-1") {
  return { params: Promise.resolve({ storyId }) };
}

// ─── Default mock data ────────────────────────────────────────────────────────
const unassignedTask = {
  id: "task-1",
  user_story_id: "story-1",
  title: "Implement login",
  description: "Implement login form",
  estimated_hours: 4,
  status: "unassigned",
  assignee_id: null,
  is_accepted: false,
  is_active: false,
  position: 0,
  assignee: null,
};

const assignedTask = {
  id: "task-2",
  user_story_id: "story-1",
  title: "Write tests",
  description: "Write unit tests",
  estimated_hours: 2,
  status: "assigned",
  assignee_id: "user-1",
  is_accepted: true,
  is_active: false,
  position: 1,
  assignee: {
    id: "user-1",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
  },
};

const activeTask = {
  id: "task-3",
  user_story_id: "story-1",
  title: "Fix bug",
  description: "Fix login bug",
  estimated_hours: 1,
  status: "in_progress",
  assignee_id: "user-2",
  is_accepted: true,
  is_active: true,
  position: 2,
  assignee: {
    id: "user-2",
    first_name: "John",
    last_name: "Smith",
    email: "john@example.com",
  },
};

const completedTask = {
  id: "task-4",
  user_story_id: "story-1",
  title: "Deploy",
  description: "Deploy to production",
  estimated_hours: 1,
  status: "completed",
  assignee_id: "user-1",
  is_accepted: true,
  is_active: false,
  position: 3,
  assignee: {
    id: "user-1",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
  },
};

// ─── Setup mocks ──────────────────────────────────────────────────────────────
function setupMocks(tasks: any[] = []) {
  mockFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: tasks, error: null }),
  }));
}

// ─── TESTS ────────────────────────────────────────────────────────────────────
describe("GET /api/stories/:storyId/tasks — task list (#28)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Returns all tasks for a story ───────────────────────────────────
  it("200 — returns all tasks for the story", async () => {
    setupMocks([unassignedTask, assignedTask, activeTask, completedTask]);

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(4);
  });

  // ─── #2: All four categories present ─────────────────────────────────────
  it("200 — returns tasks across all four categories: unassigned, assigned, active, done", async () => {
    setupMocks([unassignedTask, assignedTask, activeTask, completedTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    const statuses = body.map((t: any) => t.status);
    expect(statuses).toContain("unassigned");
    expect(statuses).toContain("assigned");
    expect(statuses).toContain("in_progress");
    expect(statuses).toContain("completed");
  });

  // ─── #3: Unassigned task has no assignee ─────────────────────────────────
  it("200 — unassigned task has null assignee_id and is_accepted = false", async () => {
    setupMocks([unassignedTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(body[0].assignee_id).toBeNull();
    expect(body[0].is_accepted).toBe(false);
    expect(body[0].assignee).toBeNull();
  });

  // ─── #4: Assigned task has assignee info ─────────────────────────────────
  it("200 — assigned task has assignee details and is_accepted = true", async () => {
    setupMocks([assignedTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(body[0].is_accepted).toBe(true);
    expect(body[0].assignee_id).toBe("user-1");
    expect(body[0].assignee).toBeDefined();
    expect(body[0].assignee.first_name).toBe("Jane");
  });

  // ─── #5: Active task ─────────────────────────────────────────────────────
  it("200 — active task has is_active = true and status in_progress", async () => {
    setupMocks([activeTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(body[0].is_active).toBe(true);
    expect(body[0].status).toBe("in_progress");
  });

  // ─── #6: Completed task ───────────────────────────────────────────────────
  it("200 — completed task has status completed", async () => {
    setupMocks([completedTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(body[0].status).toBe("completed");
  });

  // ─── #7: Empty task list ──────────────────────────────────────────────────
  it("200 — returns empty array when story has no tasks", async () => {
    setupMocks([]);

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  // ─── #8: Tasks ordered by position ───────────────────────────────────────
  it("200 — tasks are returned ordered by position ascending", async () => {
    setupMocks([unassignedTask, assignedTask, activeTask, completedTask]);

    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    const positions = body.map((t: any) => t.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  // ─── #9: Authentication ───────────────────────────────────────────────────
  it("401 — unauthenticated user cannot view tasks", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});
