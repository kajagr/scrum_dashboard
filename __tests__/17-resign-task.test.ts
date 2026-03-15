import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/tasks/[taskId]/route";

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
function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(taskId = "task-1") {
  return { params: Promise.resolve({ taskId }) };
}

// ─── Default podatki ──────────────────────────────────────────────────────────
const defaultTask = {
  id: "task-1",
  user_story_id: "story-1",
  status: "assigned",
  assignee_id: "user-1",
  is_accepted: true,
};

const defaultStory = {
  id: "story-1",
  project_id: "project-1",
  sprint_id: "sprint-1",
  status: "in_progress",
};

const defaultMembership = { role: "developer" };

// ─── Setup mock ───────────────────────────────────────────────────────────────
function setupMocks(
  overrides: {
    task?: any;
    story?: any;
    membership?: any;
    updateResult?: any;
  } = {},
) {
  const task = { ...defaultTask, ...overrides.task };
  const story = { ...defaultStory, ...overrides.story };
  const membership =
    overrides.membership !== undefined
      ? overrides.membership
      : defaultMembership;
  const updateResult = overrides.updateResult ?? {
    data: {
      id: "task-1",
      status: "unassigned",
      assignee_id: null,
      is_accepted: false,
    },
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

// ─── TESTI ────────────────────────────────────────────────────────────────────
describe("PATCH /api/tasks/:taskId — odpovedovanje nalogi (#17)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  // ─── #1: Regularen potek odpovedi ────────────────────────────────────────
  it("200 — uspešno odpoved nalogi", async () => {
    setupMocks();

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unassigned");
    expect(body.assignee_id).toBeNull();
    expect(body.is_accepted).toBe(false);
  });

  // ─── #2: Naloga ni tvoja — ni sprejeta s strani tega userja ──────────────
  it("400 — odpoved nalogi ki je ni sprejel trenutni uporabnik (drug assignee)", async () => {
    setupMocks({
      task: { ...defaultTask, assignee_id: "drug-user", is_accepted: true },
    });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lastnik/i);
  });

  it("400 — odpoved nalogi ki ni sprejeta (is_accepted = false)", async () => {
    setupMocks({
      task: { ...defaultTask, is_accepted: false },
    });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lastnik/i);
  });

  // ─── #3: Drug razvijalec lahko prevzame odpovedano nalogo ────────────────
  // Integracija s #16 — simuliramo da je naloga po odpovedi unassigned
  // in da jo drug razvijalec lahko sprejme (action: "accept")
  it("200 — drug razvijalec sprejme odpovedano nalogo", async () => {
    // Naloga je unassigned (po odpovedi)
    const unassignedTask = {
      ...defaultTask,
      assignee_id: null,
      is_accepted: false,
      status: "unassigned",
      sprint_id: "sprint-1",
    };

    const activeSprint = {
      start_date: "2020-01-01",
      end_date: "2099-12-31",
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          // tasks
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: unassignedTask, error: null }),
        };
      if (cnt === 2)
        return {
          // user_stories
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: defaultStory, error: null }),
        };
      if (cnt === 3)
        return {
          // project_members
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: { role: "developer" }, error: null }),
        };
      if (cnt === 4)
        return {
          // sprints — preveri aktivni sprint
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: activeSprint, error: null }),
        };
      return {
        // tasks — update (accept)
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "task-1",
            assignee_id: "user-2",
            is_accepted: true,
            status: "assigned",
          },
          error: null,
        }),
      };
    });

    // Drug razvijalec (user-2) sprejme nalogo
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });

    const res = await PATCH(makeRequest({ action: "accept" }), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignee_id).toBe("user-2");
    expect(body.is_accepted).toBe(true);
    expect(body.status).toBe("assigned");
  });

  // ─── Dodatni testi ────────────────────────────────────────────────────────
  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(401);
  });

  it("403 — uporabnik ni član projekta", async () => {
    setupMocks({ membership: null });

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(403);
  });

  it("404 — naloga ne obstaja", async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await PATCH(makeRequest({ action: "resign" }), makeContext());

    expect(res.status).toBe(404);
  });
});
