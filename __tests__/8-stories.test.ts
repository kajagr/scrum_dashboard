import { POST } from "@/app/api/projects/[projectId]/stories/route";
import { createClient } from "@/lib/supabase/server";

// ─── Mock createClient ───────────────────────────────────────────────────────
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

function makeRequest(body: object) {
  return new Request("http://localhost/api/projects/project-1/stories", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(projectId = "project-1") {
  return { params: Promise.resolve({ projectId }) };
}

// ─── Shared mock builder ──────────────────────────────────────────────────────
// Route calls .is("deleted_at", null) on both read queries — must be in chain.
// mockFrom is called separately for duplicate check and lastStory, so we use
// a counter to return the correct response per call instead of mockImplementationOnce
// on a shared maybeSingle (which resets on every new jest.fn() instance).
function setupMocks(
  overrides: {
    duplicateData?: any;
    lastStoryData?: any;
    insertResult?: { data: any; error: any };
  } = {},
) {
  const duplicateResult = {
    data: overrides.duplicateData ?? null,
    error: null,
  };
  const lastStoryResult = {
    data:
      overrides.lastStoryData !== undefined
        ? overrides.lastStoryData
        : { position: 4 },
    error: null,
  };
  const insertResult = overrides.insertResult ?? {
    data: {
      id: "story-1",
      project_id: "project-1",
      title: "Prijava uporabnika",
      description: "Kot uporabnik se želim prijaviti",
      acceptance_criteria: "Uspešna prijava",
      priority: "must_have",
      business_value: 80,
      story_points: 3,
      status: "backlog",
      position: 5,
      created_by: "user-1",
    },
    error: null,
  };

  let cnt = 0;
  mockFrom.mockImplementation(() => {
    cnt++;
    if (cnt === 1) {
      // duplicate check
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(duplicateResult),
      };
    }
    if (cnt === 2) {
      // last story position check
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(lastStoryResult),
      };
    }
    // insert
    return {
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(insertResult),
        }),
      }),
    };
  });
}

describe("POST /api/projects/[projectId]/stories", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    (createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });

    setupMocks();
  });

  // ─── #1: Regularen potek ────────────────────────────────────────────────
  it("201 — uspešno ustvari novo uporabniško zgodbo", async () => {
    const res = await POST(
      makeRequest({
        title: "Prijava uporabnika",
        description: "Kot uporabnik se želim prijaviti",
        acceptance_criteria: "Uspešna prijava",
        priority: "must_have",
        business_value: 80,
        story_points: 3,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Prijava uporabnika");
    expect(body.priority).toBe("must_have");
    expect(body.business_value).toBe(80);
    expect(body.position).toBe(5);
    expect(mockFrom).toHaveBeenCalledWith("user_stories");
  });

  // ─── #2: Podvajanje imena uporabniške zgodbe ────────────────────────────
  it("409 — zavrne uporabniško zgodbo z obstoječim naslovom", async () => {
    setupMocks({ duplicateData: { id: "existing-story" } });

    const res = await POST(
      makeRequest({
        title: "Prijava uporabnika",
        description: "Kot uporabnik se želim prijaviti",
        acceptance_criteria: "Uspešna prijava",
        priority: "must_have",
        business_value: 80,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  // ─── #3: Ustrezna določitev prioritete ──────────────────────────────────
  it("400 — zavrne neveljavno prioriteto", async () => {
    const res = await POST(
      makeRequest({
        title: "Registracija uporabnika",
        description: "Kot obiskovalec se želim registrirati",
        acceptance_criteria: "Uspešna registracija",
        priority: "urgent",
        business_value: 60,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid priority/i);
  });

  // ─── #4: Neregularen vnos poslovne vrednosti ────────────────────────────
  it("400 — zavrne business_value izven intervala 1 do 100", async () => {
    const res = await POST(
      makeRequest({
        title: "Obnovitev gesla",
        description: "Kot uporabnik želim obnoviti geslo",
        acceptance_criteria: "Sistem pošlje email za obnovo",
        priority: "should_have",
        business_value: 0,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 1 and 100/i);
  });

  // ─── Dodatni smiselni testi ─────────────────────────────────────────────
  it("401 — neprijavljen uporabnik ne more ustvariti zgodbe", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });

    const res = await POST(
      makeRequest({
        title: "Komentiranje nalog",
        priority: "could_have",
        business_value: 30,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("400 — manjkajo obvezna polja", async () => {
    const res = await POST(
      makeRequest({ title: "Zgodba brez prioritet" }) as any,
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("403 — zavrne uporabnika brez pravic za ustvarjanje zgodbe", async () => {
    setupMocks({
      insertResult: {
        data: null,
        error: { message: "new row violates row-level security policy" },
      },
    });

    const res = await POST(
      makeRequest({
        title: "Izvoz poročila",
        description: "Kot uporabnik želim izvoziti poročilo",
        acceptance_criteria: "PDF se uspešno izvozi",
        priority: "must_have",
        business_value: 90,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/do not have permission/i);
  });

  it("201 — ustvari prvo zgodbo s position 0, če še ni nobene zgodbe", async () => {
    setupMocks({
      lastStoryData: null,
      insertResult: {
        data: { id: "story-1", position: 0, title: "Prva zgodba" },
        error: null,
      },
    });

    const res = await POST(
      makeRequest({
        title: "Prva zgodba",
        priority: "must_have",
        business_value: 50,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.position).toBe(0);
  });

  it("400 — zavrne business_value, če ni število", async () => {
    const res = await POST(
      makeRequest({
        title: "Filtriranje rezultatov",
        priority: "could_have",
        business_value: "abc",
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 1 and 100/i);
  });

  it("400 — zavrne negativne story_points", async () => {
    const res = await POST(
      makeRequest({
        title: "Napredni dashboard",
        priority: "should_have",
        business_value: 70,
        story_points: -1,
      }) as any,
      makeContext(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/story_points/i);
  });

  it("201 — sprejme vse dovoljene prioritete", async () => {
    const priorities = ["must_have", "should_have", "could_have", "wont_have"];

    for (const p of priorities) {
      jest.clearAllMocks();
      (createClient as jest.Mock).mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      });
      setupMocks({
        lastStoryData: { position: 1 },
        insertResult: {
          data: {
            id: `story-${p}`,
            title: `Zgodba ${p}`,
            priority: p,
            business_value: 40,
            position: 2,
          },
          error: null,
        },
      });

      const res = await POST(
        makeRequest({
          title: `Zgodba ${p}`,
          priority: p,
          business_value: 40,
        }) as any,
        makeContext(),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.priority).toBe(p);
    }
  });
});
