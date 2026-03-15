import { NextRequest } from "next/server";
import { POST as CREATE_PROJECT } from "@/app/api/projects/route";
import { POST as ADD_MEMBERS } from "@/app/api/projects/[projectId]/members/route";

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

// ─── Mock permissions ─────────────────────────────────────────────────────────
const mockCanCreateProject = jest.fn();
const mockProjectNameExists = jest.fn();
const mockCanManageProjectMembers = jest.fn();

jest.mock("@/lib/permissions", () => ({
  canCreateProject: (...args: any[]) => mockCanCreateProject(...args),
  projectNameExists: (...args: any[]) => mockProjectNameExists(...args),
  canManageProjectMembers: (...args: any[]) =>
    mockCanManageProjectMembers(...args),
}));

// ─── Helper funkcije ──────────────────────────────────────────────────────────
function makeProjectRequest(body: object) {
  return new NextRequest("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeMembersRequest(body: object) {
  return new NextRequest("http://localhost/api/projects/project-1/members", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

// ─── TESTI ZA USTVARJANJE PROJEKTA ───────────────────────────────────────────
describe("POST /api/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    mockCanCreateProject.mockResolvedValue(true);
    mockProjectNameExists.mockResolvedValue(false);
  });

  // ─── #1: Uspešno ustvarjanje projekta ────────────────────────────────────
  it("201 — uspešno ustvari projekt", async () => {
    const createdProject = {
      id: "project-1",
      name: "Test projekt",
      description: null,
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          // insert project
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: createdProject, error: null }),
        };
      // insert members (creator)
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Test projekt" }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test projekt");
  });

  // ─── #2: Podvajanje imena projekta ───────────────────────────────────────
  it("400 — zavrne projekt s podvojenim imenom", async () => {
    mockProjectNameExists.mockResolvedValue(true);

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Obstoječi projekt" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  // ─── #3: Samo admin lahko ustvari projekt ────────────────────────────────
  it("403 — navaden uporabnik ne more ustvariti projekta", async () => {
    mockCanCreateProject.mockResolvedValue(false);

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Nov projekt" }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  it("400 — manjka ime projekta", async () => {
    const res = await CREATE_PROJECT(
      makeProjectRequest({ description: "Opis" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Nov projekt" }),
    );

    expect(res.status).toBe(401);
  });

  it("201 — ustvari projekt s člani", async () => {
    const createdProject = { id: "project-1", name: "Projekt s člani" };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: createdProject, error: null }),
        };
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const res = await CREATE_PROJECT(
      makeProjectRequest({
        name: "Projekt s člani",
        members: [
          { user_id: "user-1", role: "developer" },
          { user_id: "user-2", role: "scrum_master" },
        ],
      }),
    );

    expect(res.status).toBe(201);
  });
});

// ─── TESTI ZA DODAJANJE ČLANOV ────────────────────────────────────────────────
describe("POST /api/projects/:projectId/members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    mockCanManageProjectMembers.mockResolvedValue(true);
  });

  function setupMembersAddMocks(
    overrides: {
      project?: any;
      existingUsers?: any[];
      existingMembers?: any[];
      insertResult?: any;
    } = {},
  ) {
    const project = overrides.project ?? { id: "project-1" };
    const existingUsers = overrides.existingUsers ?? [
      { id: "user-1" },
      { id: "user-2" },
    ];
    const existingMembers = overrides.existingMembers ?? [];
    const insertResult = overrides.insertResult ?? {
      data: [
        { project_id: "project-1", user_id: "user-1", role: "developer" },
        { project_id: "project-1", user_id: "user-2", role: "scrum_master" },
      ],
      error: null,
    };

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1)
        return {
          // projects — preveri obstoj projekta
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: project, error: null }),
        };
      if (cnt === 2)
        return {
          // users — preveri obstoj uporabnikov
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: existingUsers, error: null }),
        };
      if (cnt === 3)
        return {
          // project_members — preveri že obstoječe člane
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest
            .fn()
            .mockResolvedValue({ data: existingMembers, error: null }),
        };
      return {
        // project_members — insert
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(insertResult),
      };
    });
  }

  // ─── #1: Uspešno dodajanje članov z vlogami ──────────────────────────────
  it("201 — uspešno doda člane z vlogami", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [
          { user_id: "user-1", role: "developer" },
          { user_id: "user-2", role: "scrum_master" },
        ],
      }),
      makeContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
  });

  // ─── #2: Neveljavna vloga ─────────────────────────────────────────────────
  it("400 — zavrne neveljavno vlogo", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "invalid_role" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/neveljavna vloga/i);
  });

  // ─── #3: Brez pravic ─────────────────────────────────────────────────────
  it("403 — uporabnik brez pravic ne more dodajati članov", async () => {
    mockCanManageProjectMembers.mockResolvedValue(false);

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/pravic/i);
  });

  it("400 — podvojeni uporabniki v requestu", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [
          { user_id: "user-1", role: "developer" },
          { user_id: "user-1", role: "scrum_master" }, // duplikat
        ],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/podvojene/i);
  });

  it("400 — uporabnik ne obstaja", async () => {
    setupMembersAddMocks({
      existingUsers: [], // noben user ne obstaja
    });

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "neobstojeci-user", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ne obstajajo/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });
});
