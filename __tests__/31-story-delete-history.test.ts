import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/stories/[storyId]/route";

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

function makeReadChain(resolved: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolved),
  };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/stories/story-1", { method: "DELETE" });
}
function makeContext() {
  return { params: Promise.resolve({ storyId: "story-1" }) };
}

const storyInSprint = {
  id: "story-1",
  project_id: "project-1",
  status: "backlog",
  sprint_id: "sprint-1",
};
const storyNotInSprint = { ...storyInSprint, sprint_id: null };

describe("DELETE /api/stories/:storyId — history row (#31)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("sets removed_at on history row when deleting a story assigned to a sprint", async () => {
    // Sprint is future (not active) so deletion is allowed
    const sprint = { start_date: "2099-01-01", end_date: "2099-12-31" };
    const updateHistoryMock = jest.fn().mockReturnThis();
    const eqHistoryMock = jest.fn().mockReturnThis();
    const isHistoryMock = jest.fn().mockResolvedValue({ error: null });

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeReadChain({ data: storyInSprint, error: null }); // story
      if (cnt === 2) return makeReadChain({ data: { role: "product_owner" }, error: null }); // membership
      return makeReadChain({ data: sprint, error: null }); // sprint
    });

    let adminCnt = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCnt++;
      if (adminCnt === 1) {
        // soft delete: update deleted_at
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      // history update
      return {
        update: updateHistoryMock,
        eq: eqHistoryMock,
        is: isHistoryMock,
      };
    });

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(updateHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ removed_at: expect.any(String) }),
    );
  });

  it("does NOT call history update when story has no sprint_id", async () => {
    const softDeleteUpdateMock = jest.fn().mockReturnThis();
    const softDeleteEqMock = jest.fn().mockResolvedValue({ error: null });

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeReadChain({ data: storyNotInSprint, error: null });
      return makeReadChain({ data: { role: "product_owner" }, error: null });
    });

    mockAdminFrom.mockImplementation(() => ({
      update: softDeleteUpdateMock,
      eq: softDeleteEqMock,
    }));

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    // Only one admin call (soft delete), no history update
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });
});
