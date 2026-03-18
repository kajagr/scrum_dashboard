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

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── CREATE PROJECT TESTS ─────────────────────────────────────────────────────
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

  // ─── #1: Successful project creation ─────────────────────────────────────
  it("201 — successfully creates a project", async () => {
    const createdProject = {
      id: "project-1",
      name: "Test Project",
      description: null,
    };

    mockFrom.mockImplementation(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: createdProject, error: null }),
    }));

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Test Project" }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Test Project");
    expect(body.id).toBe("project-1");
  });

  // ─── #2: Duplicate project name ───────────────────────────────────────────
  it("400 — rejects project with duplicate name", async () => {
    mockProjectNameExists.mockResolvedValue(true);

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Existing Project" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  // ─── #3: Only admins can create projects ──────────────────────────────────
  it("403 — non-admin user cannot create a project", async () => {
    mockCanCreateProject.mockResolvedValue(false);

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "New Project" }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/administrator/i);
  });

  // ─── #4: Missing project name ─────────────────────────────────────────────
  it("400 — missing project name", async () => {
    const res = await CREATE_PROJECT(
      makeProjectRequest({ description: "Some description" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name.*required|required.*name/i);
  });

  // ─── #5: Unauthenticated user ─────────────────────────────────────────────
  it("401 — unauthenticated user cannot create a project", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "New Project" }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ─── #6: Project created without members ─────────────────────────────────
  it("201 — creates project without any members", async () => {
    const createdProject = { id: "project-1", name: "Solo Project" };

    mockFrom.mockImplementation(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: createdProject, error: null }),
    }));

    const res = await CREATE_PROJECT(
      makeProjectRequest({ name: "Solo Project" }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("project-1");
  });
});

// ─── ADD MEMBERS TESTS ────────────────────────────────────────────────────────
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
          // projects — check project exists
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockResolvedValue({ data: project, error: null }),
        };
      if (cnt === 2)
        return {
          // users — check users exist
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: existingUsers, error: null }),
        };
      if (cnt === 3)
        return {
          // project_members — check already existing members
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

  // ─── #1: Successfully add members with roles ──────────────────────────────
  it("201 — successfully adds members with roles", async () => {
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
    expect(body.message).toMatch(/successfully added/i);
  });

  // ─── #2: Invalid role ─────────────────────────────────────────────────────
  it("400 — rejects invalid role", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "invalid_role" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid role/i);
  });

  // ─── #3: No permission ────────────────────────────────────────────────────
  it("403 — user without permission cannot add members", async () => {
    mockCanManageProjectMembers.mockResolvedValue(false);

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  // ─── #4: Duplicate users in request ──────────────────────────────────────
  it("400 — rejects duplicate users in the request", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [
          { user_id: "user-1", role: "developer" },
          { user_id: "user-1", role: "scrum_master" }, // duplicate
        ],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/duplicate/i);
  });

  // ─── #5: User does not exist ──────────────────────────────────────────────
  it("400 — rejects non-existent users", async () => {
    setupMembersAddMocks({
      existingUsers: [], // no users exist
    });

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "nonexistent-user", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/do not exist/i);
  });

  // ─── #6: Unauthenticated user ─────────────────────────────────────────────
  it("401 — unauthenticated user cannot add members", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "developer" }],
      }),
      makeContext(),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  // ─── #7: Empty members list ───────────────────────────────────────────────
  it("400 — rejects empty members list", async () => {
    setupMembersAddMocks();

    const res = await ADD_MEMBERS(
      makeMembersRequest({ members: [] }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  // ─── #8: Project not found ────────────────────────────────────────────────
  it("404 — returns 404 if project does not exist", async () => {
    // Set up mock directly — project check returns null
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await ADD_MEMBERS(
      makeMembersRequest({
        members: [{ user_id: "user-1", role: "developer" }],
      }),
      makeContext("nonexistent-project"),
    );

    expect(res.status).toBe(404);
  });
});
