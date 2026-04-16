import { NextRequest } from "next/server";
import { POST as ASSIGN } from "@/app/api/projects/[projectId]/backlog/assign/route";

const mockGetUser = jest.fn();
const mockFrom = jest.fn<any, any>();
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/projects/proj-1/backlog/assign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
function makeContext() {
  return { params: Promise.resolve({ projectId: "proj-1" }) };
}

describe("POST /api/projects/:projectId/backlog/assign — history (#30)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("inserts a story_sprint_history row for each assigned story", async () => {
    const activeSprint = {
      id: "sprint-1",
      name: "Sprint 1",
      start_date: "2026-01-01",
      end_date: "2099-12-31",
      velocity: null,
    };
    const stories = [
      { id: "story-1", project_id: "proj-1", status: "backlog", sprint_id: null, story_points: 3 },
    ];

    let cnt = 0;
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) {
        // sprints
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: activeSprint, error: null }),
          }),
        };
      }
      if (cnt === 2) {
        // user_stories select
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ data: stories, error: null }),
        };
      }
      // user_stories update
      return {
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
    });

    mockAdminFrom.mockImplementation(() => ({ insert: insertMock }));

    const res = await ASSIGN(makeRequest({ storyIds: ["story-1"] }), makeContext());
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_story_id: "story-1", sprint_id: "sprint-1" }),
      ]),
    );
  });
});
