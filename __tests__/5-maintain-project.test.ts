import { NextRequest } from "next/server";
import { PUT } from "@/app/api/projects/[projectId]/route";
import { POST } from "@/app/api/projects/[projectId]/members/route";
import {
  DELETE,
  PATCH,
} from "@/app/api/projects/[projectId]/members/[userId]/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Mock createServerClient ──────────────────────────────────────────────────
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

// ─── Mock canManageProjectMembers ─────────────────────────────────────────────
const mockCanManage = jest.fn();

jest.mock("@/lib/permissions", () => ({
  canManageProjectMembers: (...args: any[]) => mockCanManage(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePutRequest(body: object) {
  return new NextRequest("http://localhost/api/projects/project-1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePostRequest(body: object) {
  return new NextRequest("http://localhost/api/projects/project-1/members", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest(
    "http://localhost/api/projects/project-1/members/user-2",
    {
      method: "DELETE",
    },
  );
}

function makePatchMemberRequest(body: object) {
  return new NextRequest(
    "http://localhost/api/projects/project-1/members/user-2",
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeProjectContext(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

function makeMemberContext(projectId = "project-1", userId = "user-2") {
  return { params: Promise.resolve({ projectId, userId }) };
}

// ─── Read chain: supports .select().eq().eq().maybeSingle() ───────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue(resolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
  };
}

// ─── Admin chain: .delete()/.update() + two .eq() calls (second is terminal) ──
function makeAdminWriteChain(resolvedValue: { error: any }) {
  const secondEq = jest.fn().mockResolvedValue(resolvedValue);
  const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
  return {
    delete: jest.fn().mockReturnValue({ eq: firstEq }),
    update: jest.fn().mockReturnValue({ eq: firstEq }),
  };
}

// ─── PUT /api/projects/[projectId] ────────────────────────────────────────────
describe("PUT /api/projects/:projectId — sprememba imena projekta (#5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  function setupPutMocks(
    overrides: {
      membership?: any;
      systemRole?: string;
      duplicate?: any;
    } = {},
  ) {
    const membership =
      overrides.membership !== undefined
        ? overrides.membership
        : { role: "scrum_master" };
    const systemRole = overrides.systemRole ?? "user";
    const duplicate = overrides.duplicate ?? null;

    // PUT uses Promise.all for membership + userData → match by table name
    mockFrom.mockImplementation((table: string) => {
      if (table === "project_members")
        return makeReadChain({ data: membership, error: null });
      if (table === "users")
        return makeReadChain({
          data: { system_role: systemRole },
          error: null,
        });
      if (table === "projects") {
        // duplicate check: .ilike().neq().maybeSingle()
        // update:          .update().eq().select().single()
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnValue({
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: duplicate, error: null }),
          }),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: "project-1", name: "Updated name" },
            error: null,
          }),
        };
        return chain;
      }
      return makeReadChain({ data: null, error: null });
    });
  }

  it("200 — scrum_master uspešno posodobi ime projekta", async () => {
    setupPutMocks();
    const res = await PUT(
      makePutRequest({ name: "Updated name" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated name");
  });

  it("200 — admin uspešno posodobi ime projekta", async () => {
    setupPutMocks({ membership: null, systemRole: "admin" });
    const res = await PUT(
      makePutRequest({ name: "Admin update" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(200);
  });

  it("409 — zavrne podvojeno ime projekta", async () => {
    setupPutMocks({ duplicate: { id: "other-project" } });
    const res = await PUT(
      makePutRequest({ name: "Obstoječ projekt" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("400 — manjka ime projekta", async () => {
    const res = await PUT(makePutRequest({ name: "" }), makeProjectContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("403 — developer ne more urejati projekta", async () => {
    setupPutMocks({ membership: { role: "developer" } });
    const res = await PUT(
      makePutRequest({ name: "Test" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("403 — ne-član ne more urejati projekta", async () => {
    setupPutMocks({ membership: null });
    const res = await PUT(
      makePutRequest({ name: "Test" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PUT(
      makePutRequest({ name: "Test" }),
      makeProjectContext(),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });
});

// ─── POST /api/projects/[projectId]/members ───────────────────────────────────
describe("POST /api/projects/:projectId/members — dodajanje člana (#5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockCanManage.mockResolvedValue(true);
  });

  function setupPostMocks(
    overrides: {
      projectExists?: boolean;
      existingUsers?: string[];
      alreadyMembers?: string[];
      insertError?: any;
    } = {},
  ) {
    const projectExists = overrides.projectExists ?? true;
    const existingUsers = overrides.existingUsers ?? ["user-2"];
    const alreadyMembers = overrides.alreadyMembers ?? [];
    const insertError = overrides.insertError ?? null;

    // Sequential calls — use a counter
    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        // projects — existence: .select().eq().maybeSingle()
        return makeReadChain({
          data: projectExists ? { id: "project-1" } : null,
          error: null,
        });
      if (cnt === 2)
        // users — existence: .select().in()
        return makeReadChain({
          data: existingUsers.map((id) => ({ id })),
          error: null,
        });
      if (cnt === 3)
        // project_members — already in: .select().eq().in()
        return makeReadChain({
          data: alreadyMembers.map((id) => ({ user_id: id })),
          error: null,
        });
      if (cnt === 4 && alreadyMembers.length > 0)
        // users — fetch usernames: .select().in()
        return makeReadChain({
          data: alreadyMembers.map((id) => ({ username: id })),
          error: null,
        });
      // project_members — insert: .insert().select()
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: "mem-1",
              project_id: "project-1",
              user_id: "user-2",
              role: "developer",
            },
          ],
          error: insertError,
        }),
      };
    });
  }

  it("201 — uspešno doda novega člana", async () => {
    setupPostMocks();
    const res = await POST(
      makePostRequest({ members: [{ user_id: "user-2", role: "developer" }] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toMatch(/successfully added/i);
  });

  it("400 — uporabnik je že član projekta", async () => {
    setupPostMocks({ alreadyMembers: ["user-2"] });
    const res = await POST(
      makePostRequest({ members: [{ user_id: "user-2", role: "developer" }] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already members/i);
  });

  it("400 — neveljavna vloga", async () => {
    setupPostMocks();
    const res = await POST(
      makePostRequest({ members: [{ user_id: "user-2", role: "manager" }] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid role/i);
  });

  it("400 — uporabnik ne obstaja", async () => {
    setupPostMocks({ existingUsers: [] });
    const res = await POST(
      makePostRequest({
        members: [{ user_id: "nonexistent", role: "developer" }],
      }),
      makeProjectContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/do not exist/i);
  });

  it("400 — prazna lista članov", async () => {
    setupPostMocks();
    const res = await POST(
      makePostRequest({ members: [] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("400 — podvojeni uporabniki v listi", async () => {
    setupPostMocks();
    const res = await POST(
      makePostRequest({
        members: [
          { user_id: "user-2", role: "developer" },
          { user_id: "user-2", role: "scrum_master" },
        ],
      }),
      makeProjectContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duplicate/i);
  });

  it("403 — brez pravic za upravljanje članov", async () => {
    mockCanManage.mockResolvedValue(false);
    const res = await POST(
      makePostRequest({ members: [{ user_id: "user-2", role: "developer" }] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(
      makePostRequest({ members: [{ user_id: "user-2", role: "developer" }] }),
      makeProjectContext(),
    );
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/projects/[projectId]/members/[userId] ────────────────────────
describe("DELETE /api/projects/:projectId/members/:userId — odstranjevanje člana (#5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  function setupDeleteMocks(
    overrides: {
      callerMembership?: any;
      callerSystemRole?: string;
      targetMember?: any;
      deleteError?: any;
    } = {},
  ) {
    const callerMembership =
      overrides.callerMembership !== undefined
        ? overrides.callerMembership
        : { role: "scrum_master" };
    const callerSystemRole = overrides.callerSystemRole ?? "user";
    const targetMember =
      overrides.targetMember !== undefined
        ? overrides.targetMember
        : { role: "developer" };
    const deleteError = overrides.deleteError ?? null;

    // getCallerPermission uses Promise.all → project_members + users called simultaneously
    // then target member check calls project_members again
    // Use per-table counters to differentiate the two project_members calls
    const tableCounters: Record<string, number> = {};
    mockFrom.mockImplementation((table: string) => {
      tableCounters[table] = (tableCounters[table] ?? 0) + 1;
      const callNum = tableCounters[table];

      if (table === "project_members")
        // call 1 = caller membership, call 2 = target member
        return makeReadChain({
          data: callNum === 1 ? callerMembership : targetMember,
          error: null,
        });
      if (table === "users")
        return makeReadChain({
          data: { system_role: callerSystemRole },
          error: null,
        });
      return makeReadChain({ data: null, error: null });
    });

    mockAdminFrom.mockImplementation(() =>
      makeAdminWriteChain({ error: deleteError }),
    );
  }

  it("200 — scrum_master uspešno odstrani člana", async () => {
    setupDeleteMocks();
    const res = await DELETE(makeDeleteRequest(), makeMemberContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/removed successfully/i);
  });

  it("403 — developer ne more odstraniti člana", async () => {
    setupDeleteMocks({ callerMembership: { role: "developer" } });
    const res = await DELETE(makeDeleteRequest(), makeMemberContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("404 — član ne obstaja", async () => {
    setupDeleteMocks({ targetMember: null });
    const res = await DELETE(makeDeleteRequest(), makeMemberContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE(makeDeleteRequest(), makeMemberContext());
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/projects/[projectId]/members/[userId] ─────────────────────────
describe("PATCH /api/projects/:projectId/members/:userId — sprememba vloge (#5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  function setupPatchMemberMocks(
    overrides: {
      callerMembership?: any;
      callerSystemRole?: string;
      targetMember?: any;
      updateError?: any;
    } = {},
  ) {
    const callerMembership =
      overrides.callerMembership !== undefined
        ? overrides.callerMembership
        : { role: "scrum_master" };
    const callerSystemRole = overrides.callerSystemRole ?? "user";
    const targetMember =
      overrides.targetMember !== undefined
        ? overrides.targetMember
        : { role: "developer" };
    const updateError = overrides.updateError ?? null;

    const tableCounters: Record<string, number> = {};
    mockFrom.mockImplementation((table: string) => {
      tableCounters[table] = (tableCounters[table] ?? 0) + 1;
      const callNum = tableCounters[table];

      if (table === "project_members")
        return makeReadChain({
          data: callNum === 1 ? callerMembership : targetMember,
          error: null,
        });
      if (table === "users")
        return makeReadChain({
          data: { system_role: callerSystemRole },
          error: null,
        });
      return makeReadChain({ data: null, error: null });
    });

    mockAdminFrom.mockImplementation(() =>
      makeAdminWriteChain({ error: updateError }),
    );
  }

  it("200 — scrum_master uspešno spremeni vlogo člana", async () => {
    setupPatchMemberMocks();
    const res = await PATCH(
      makePatchMemberRequest({ role: "scrum_master" }),
      makeMemberContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/updated successfully/i);
  });

  it("400 — neveljavna vloga", async () => {
    setupPatchMemberMocks();
    const res = await PATCH(
      makePatchMemberRequest({ role: "manager" }),
      makeMemberContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid role/i);
  });

  it("403 — developer ne more spremeniti vloge", async () => {
    setupPatchMemberMocks({ callerMembership: { role: "developer" } });
    const res = await PATCH(
      makePatchMemberRequest({ role: "developer" }),
      makeMemberContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("404 — član ne obstaja", async () => {
    setupPatchMemberMocks({ targetMember: null });
    const res = await PATCH(
      makePatchMemberRequest({ role: "developer" }),
      makeMemberContext(),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PATCH(
      makePatchMemberRequest({ role: "developer" }),
      makeMemberContext(),
    );
    expect(res.status).toBe(401);
  });
});
