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

// ─── Helper funkcije ──────────────────────────────────────────────────────────
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

// ─── Default podatki ──────────────────────────────────────────────────────────
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
  description: "Posodobljen opis",
  estimated_hours: 3,
};

// ─── Setup mock za PATCH ──────────────────────────────────────────────────────
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
    data: { id: "task-1", description: "Posodobljen opis" },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
      };
    if (cnt === 2)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 3)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    return {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(updateResult),
    };
  });
}

// ─── Setup mock za DELETE ─────────────────────────────────────────────────────
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
    if (cnt === 1)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: task, error: null }),
      };
    if (cnt === 2)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: story, error: null }),
      };
    if (cnt === 3)
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: membership, error: null }),
      };
    return {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
  });
}

// ─── TESTI ZA PATCH ───────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — urejanje naloge (#15)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno uredi nesprejeto nalogo", async () => {
    setupPatchMocks();

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(200);
  });

  // ─── #2: Sprejeta naloga — ne more urejati ────────────────────────────────
  it("400 — ne more urejati sprejete naloge", async () => {
    setupPatchMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprejete/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — uporabnik ni član projekta", async () => {
    setupPatchMocks({ membership: null });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("403 — product_owner nima pravic", async () => {
    setupPatchMocks({ membership: { role: "product_owner" } });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(403);
  });

  it("400 — neveljavna ocena časa (0)", async () => {
    setupPatchMocks();

    const res = await PATCH(
      makePatchRequest({ ...editBody, estimated_hours: 0 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/časa|pozitivno/i);
  });

  it("400 — neveljavna ocena časa (negativna)", async () => {
    setupPatchMocks();

    const res = await PATCH(
      makePatchRequest({ ...editBody, estimated_hours: -1 }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(401);
  });

  it("404 — naloga ne obstaja", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await PATCH(makePatchRequest(editBody), makeContext());
    expect(res.status).toBe(404);
  });
});

// ─── TESTI ZA DELETE ──────────────────────────────────────────────────────────
describe("DELETE /api/tasks/:taskId — brisanje naloge (#15)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek ──────────────────────────────────────────────────
  it("200 — uspešno izbriše nesprejeto nalogo", async () => {
    setupDeleteMocks();

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/izbrisana/i);
  });

  // ─── #2: Brisanje sprejete naloge ─────────────────────────────────────────
  it("400 — ne more izbrisati sprejete naloge", async () => {
    setupDeleteMocks({
      task: { ...defaultTask, is_accepted: true, assignee_id: "user-2" },
    });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sprejete/i);
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("403 — product_owner nima pravic za brisanje", async () => {
    setupDeleteMocks({ membership: { role: "product_owner" } });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(401);
  });

  it("404 — naloga ne obstaja", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await DELETE(makeDeleteRequest(), makeContext());
    expect(res.status).toBe(404);
  });
});
