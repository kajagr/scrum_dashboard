import { NextRequest } from "next/server";
import {
  GET as GET_DOC,
  PUT,
} from "@/app/api/projects/[projectId]/documentation/route";
import { POST as IMPORT } from "@/app/api/projects/[projectId]/documentation/import/route";
import { GET as EXPORT } from "@/app/api/projects/[projectId]/documentation/export/route";

// ─── Mock supabaseAdmin (@supabase/supabase-js) ───────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Mock server supabase client ──────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReadChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makeContext(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

function makePutRequest(body: object) {
  return new NextRequest(
    "http://localhost/api/projects/project-1/documentation",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function makeExportRequest(format?: string) {
  const url = format
    ? `http://localhost/api/projects/project-1/documentation/export?format=${format}`
    : "http://localhost/api/projects/project-1/documentation/export";
  return new NextRequest(url, { method: "GET" });
}

function makeImportRequest(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return new NextRequest(
    "http://localhost/api/projects/project-1/documentation/import",
    { method: "POST", body: formData },
  );
}

const sampleContent = "## Sprint 1\nImplementirali smo avtentikacijo.";

// ─── Setup helpers ────────────────────────────────────────────────────────────
function setupMember(isMember = true) {
  mockFrom.mockImplementation(() =>
    makeReadChain({
      data: isMember ? { role: "developer" } : null,
      error: null,
    }),
  );
}

function setupMemberThenDoc(docData: any) {
  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1)
      return makeReadChain({ data: { role: "developer" }, error: null });
    return makeReadChain({ data: docData, error: null });
  });
}

// ─── GET /api/projects/[projectId]/documentation ──────────────────────────────
describe("GET /api/projects/:projectId/documentation — urejanje dokumentacije (#21)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — član dobi dokumentacijo", async () => {
    setupMemberThenDoc({
      content: sampleContent,
      updated_by: "user-1",
      updated_at: "2024-01-01T00:00:00Z",
    });
    const res = await GET_DOC(
      new NextRequest("http://localhost/api/projects/project-1/documentation"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe(sampleContent);
  });

  it("200 — vrne prazen content če dokumentacija še ne obstaja", async () => {
    setupMemberThenDoc(null);
    const res = await GET_DOC(
      new NextRequest("http://localhost/api/projects/project-1/documentation"),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe("");
    expect(body.updated_by).toBeNull();
  });

  it("403 — ne-član ne more videti dokumentacije", async () => {
    setupMember(false);
    const res = await GET_DOC(
      new NextRequest("http://localhost/api/projects/project-1/documentation"),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET_DOC(
      new NextRequest("http://localhost/api/projects/project-1/documentation"),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/projects/[projectId]/documentation ──────────────────────────────
describe("PUT /api/projects/:projectId/documentation — shranjevanje dokumentacije (#21)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockAdminFrom.mockImplementation(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }));
  });

  it("200 — član uspešno shrani dokumentacijo", async () => {
    setupMember(true);
    const res = await PUT(
      makePutRequest({ content: sampleContent }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/saved successfully/i);
  });

  it("200 — shrani prazno vsebino (privzeta vrednost)", async () => {
    setupMember(true);
    const res = await PUT(makePutRequest({}), makeContext());
    expect(res.status).toBe(200);
  });

  it("403 — ne-član ne more shraniti dokumentacije", async () => {
    setupMember(false);
    const res = await PUT(
      makePutRequest({ content: sampleContent }),
      makeContext(),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await PUT(
      makePutRequest({ content: sampleContent }),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/projects/[projectId]/documentation/import ─────────────────────
describe("POST /api/projects/:projectId/documentation/import — uvoz dokumentacije (#21)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockAdminFrom.mockImplementation(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }));
  });

  it("200 — uspešno uvozi .md datoteko", async () => {
    setupMember(true);
    const file = new File([sampleContent], "documentation.md", {
      type: "text/markdown",
    });
    const res = await IMPORT(makeImportRequest(file), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/imported successfully/i);
    expect(body.content).toBe(sampleContent);
  });

  it("200 — uspešno uvozi .txt datoteko", async () => {
    setupMember(true);
    const file = new File(["plain text content"], "documentation.txt", {
      type: "text/plain",
    });
    const res = await IMPORT(makeImportRequest(file), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe("plain text content");
  });

  it("400 — zavrne datoteko brez priponke", async () => {
    setupMember(true);
    const formData = new FormData();
    // brez file
    const req = new NextRequest(
      "http://localhost/api/projects/project-1/documentation/import",
      { method: "POST", body: formData },
    );
    const res = await IMPORT(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no file/i);
  });

  it("400 — zavrne nepodprt format (.pdf)", async () => {
    setupMember(true);
    const file = new File(["pdf content"], "documentation.pdf", {
      type: "application/pdf",
    });
    const res = await IMPORT(makeImportRequest(file), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported file format/i);
  });

  it("403 — ne-član ne more uvoziti dokumentacije", async () => {
    setupMember(false);
    const file = new File([sampleContent], "documentation.md", {
      type: "text/markdown",
    });
    const res = await IMPORT(makeImportRequest(file), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const file = new File([sampleContent], "documentation.md", {
      type: "text/markdown",
    });
    const res = await IMPORT(makeImportRequest(file), makeContext());
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/projects/[projectId]/documentation/export ──────────────────────
describe("GET /api/projects/:projectId/documentation/export — izvoz dokumentacije (#21)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("200 — izvozi dokumentacijo kot .md (privzeto)", async () => {
    setupMemberThenDoc({ content: sampleContent });
    const res = await EXPORT(makeExportRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/markdown/i);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /documentation\.md/i,
    );
    const text = await res.text();
    expect(text).toBe(sampleContent);
  });

  it("200 — izvozi dokumentacijo kot .txt", async () => {
    setupMemberThenDoc({ content: sampleContent });
    const res = await EXPORT(makeExportRequest("txt"), makeContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/i);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /documentation\.txt/i,
    );
  });

  it("200 — vrne prazen file če dokumentacija ne obstaja", async () => {
    setupMemberThenDoc(null);
    const res = await EXPORT(makeExportRequest("md"), makeContext());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("400 — zavrne nepodprt format", async () => {
    setupMember(true);
    const res = await EXPORT(makeExportRequest("pdf"), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported format/i);
  });

  it("403 — ne-član ne more izvoziti dokumentacije", async () => {
    setupMember(false);
    const res = await EXPORT(makeExportRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await EXPORT(makeExportRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});
