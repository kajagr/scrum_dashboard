import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/tasks/[taskId]/route";

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
function makePatchRequest(body: object) {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "DELETE",
  });
}

function makeContext(taskId = "task-1") {
  return { params: Promise.resolve({ taskId }) };
}

// ─── Shared mock builders ─────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), // route calls .is("deleted_at", null)
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
  };
}

function makeUpdateChain(resolvedValue: { data: any; error: any }) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Default data ─────────────────────────────────────────────────────────────
const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  status: "unassigned",
  assignee_id: null,
  is_accepted: false,
};

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  sprint_id: "sprint-1",
  status: "in_progress",
};

const defaultMembership = { role: "developer" };

const editBody = {
  action: "edit",
  description: "Updated description",
  estimated_hours: 3,
};

// ─── Setup mocks for PATCH ────────────────────────────────────────────────────
function setupPatchMocks(
  overrides: {
    task?: any;
    story?: any;
    membership?: any;
    updateResult?: any;
  } = {},
) {
  const task = overrides.task !== undefined ? overrides.task : defaultTask;
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const updateResult = overrides.updateResult ?? {
    data: { id: "task-1", description: "Updated description" },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks
    if (cnt === 2) return makeReadChain({ data: story, error: null }); // user_stories
    if (cnt === 3) return makeReadChain({ data: membership, error: null }); // project_members
    return makeUpdateChain(updateResult); // tasks UPDATE
  });
}

// ─── Setup mocks for DELETE ───────────────────────────────────────────────────
function setupDeleteMocks(
  overrides: {
    task?: any;
    story?: any;
    membership?: any;
  } = {},
) {
  const task = overrides.task !== undefined ? overrides.task : defaultTask;
  const story = overrides.story !== undefined ? overrides.story : defaultStory;
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) return makeReadChain({ data: task, error: null }); // tasks
    if (cnt === 2) return makeReadChain({ data: story, error: null }); // user_stories
    if (cnt === 3) return makeReadChain({ data: membership, error: null }); // project_members
    // soft delete: .update({ deleted_at: ... }).eq()  — NOT .delete()
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
  });
}

// ─── PATCH TESTS ──────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — edit task (#15)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful edit ──────────────────────────────────────────────────
  it("200 — successfully edits an unaccepted task", async () => {
    setupPatchMocks();

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("task-1");
  });

  // ─── #2: Accepted task cannot be edited ───────────────────────────────────
  it("400 — cannot edit an accepted task", async () => {
    setupPatchMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/accepted tasks cannot be edited/i);
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("403 — user is not a project member", async () => {
    setupPatchMocks({ membership: null });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("403 — product_owner does not have permission to edit tasks", async () => {
    setupPatchMocks({ membership: { role: "product_owner" } });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("400 — invalid estimated hours (zero)", async () => {
    setupPatchMocks();

    const res = await PATCH(
      makePatchRequest({ ...editBody, estimated_hours: 0 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive/i);
  });

  it("400 — invalid estimated hours (negative)", async () => {
    setupPatchMocks();

    const res = await PATCH(
      makePatchRequest({ ...editBody, estimated_hours: -1 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/positive/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("404 — task does not exist", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeReadChain({ data: null, error: null }),
    );

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

// ─── DELETE TESTS ─────────────────────────────────────────────────────────────
describe("DELETE /api/tasks/:taskId — delete task (#15)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Successful delete ────────────────────────────────────────────────
  it("200 — successfully deletes an unaccepted task", async () => {
    setupDeleteMocks();

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deleted successfully/i);
  });

  // ─── #2: Accepted task cannot be deleted ──────────────────────────────────
  it("400 — cannot delete an accepted task", async () => {
    setupDeleteMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/accepted tasks cannot be deleted/i);
  });

  // ─── Additional tests ─────────────────────────────────────────────────────
  it("403 — product_owner does not have permission to delete tasks", async () => {
    setupDeleteMocks({ membership: { role: "product_owner" } });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("401 — unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("404 — task does not exist", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeReadChain({ data: null, error: null }),
    );

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
