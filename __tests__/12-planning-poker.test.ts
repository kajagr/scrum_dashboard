import { NextRequest } from "next/server";
import {
  POST as postStartSession,
  GET as getStorySession,
} from "@/app/api/stories/[storyId]/poker/route";
import { POST as postVote } from "@/app/api/poker/[sessionId]/vote/route";
import { GET as getSessionState } from "@/app/api/poker/[sessionId]/route";
import { POST as postNextRound } from "@/app/api/poker/[sessionId]/next-round/route";
import { POST as postComplete } from "@/app/api/poker/[sessionId]/complete/route";

// ─── Mock @/lib/supabase/server (server client) ───────────────────────────────
const mockFrom = jest.fn<any, any>();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: any[]) => mockFrom(...args),
    }),
  ),
}));

// ─── Mock @supabase/supabase-js (admin client) ────────────────────────────────
const mockAdminFrom = jest.fn<any, any>();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: any[]) => mockAdminFrom(...args),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve: (v: any) => any) => resolve(resolvedValue)),
  };
  return chain;
}

function makePostRequest(url: string, body: object) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeContext(params: Record<string, string>): any {
  return { params: Promise.resolve(params) };
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const USER_ID = "user-sm";
const DEV_ID = "user-dev";
const PROJECT_ID = "project-1";
const STORY_ID = "story-1";
const SESSION_ID = "session-1";

const activeSession = {
  id: SESSION_ID,
  project_id: PROJECT_ID,
  user_story_id: STORY_ID,
  status: "active",
  current_round: 1,
  absent_member_ids: [],
};

const completedSession = { ...activeSession, status: "completed" };

const scrumMasterMembership = { role: "scrum_master" };
const developerMembership = { role: "developer" };

const allMembers = [
  { user_id: USER_ID, role: "scrum_master" },
  { user_id: DEV_ID, role: "developer" },
];

const allVotedCurrentRound = [{ user_id: USER_ID }, { user_id: DEV_ID }];

// ─── POST /api/stories/:storyId/poker — začetek igre (#12) ───────────────────

describe("POST /api/stories/:storyId/poker — začetek igre (#12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  // DB calls (supabase):
  //   cnt=1: user_stories fetch   → maybeSingle
  //   cnt=2: project_members      → maybeSingle
  //   cnt=3: poker_sessions check → maybeSingle
  // Admin calls:
  //   cnt=1: poker_sessions insert → maybeSingle
  function setupPostStartMocks(
    overrides: {
      story?: any;
      membership?: any;
      activeSession?: any;
      insertResult?: any;
    } = {},
  ) {
    const {
      story = {
        id: STORY_ID,
        project_id: PROJECT_ID,
        sprint_id: null,
        status: "todo",
      },
      membership = scrumMasterMembership,
      activeSession: existing = null,
      insertResult = { data: { ...activeSession }, error: null },
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: story, error: null });
      if (cnt === 2) return makeChain({ data: membership, error: null });
      if (cnt === 3) return makeChain({ data: existing, error: null });
      return makeChain({ data: null, error: null });
    });

    mockAdminFrom.mockImplementation(() => makeChain(insertResult));
  }

  // AC1 – regularen potek
  it("201 — scrum master uspešno začne poker sejo za nedodeljeno zgodbo", async () => {
    setupPostStartMocks();
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.current_round).toBe(1);
  });

  it("200 — vrne obstoječo aktivno sejo če že obstaja", async () => {
    setupPostStartMocks({ activeSession: activeSession });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(SESSION_ID);
  });

  it("400 — zgodba je že dodeljena sprintu", async () => {
    setupPostStartMocks({
      story: {
        id: STORY_ID,
        project_id: PROJECT_ID,
        sprint_id: "sprint-1",
        status: "todo",
      },
    });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/dodeljena sprintu/i);
  });

  it("400 — zaključenih zgodb ni mogoče ocenjevati", async () => {
    setupPostStartMocks({
      story: {
        id: STORY_ID,
        project_id: PROJECT_ID,
        sprint_id: null,
        status: "done",
      },
    });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/zaključenih/i);
  });

  it("403 — developer ne more začeti seje", async () => {
    setupPostStartMocks({ membership: developerMembership });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/skrbnik metodologije/i);
  });

  it("403 — neuporabnik projekta ne more začeti seje", async () => {
    setupPostStartMocks({ membership: null });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(403);
  });

  it("404 — zgodba ne obstaja", async () => {
    setupPostStartMocks({ story: null });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/ne obstaja/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await postStartSession(
      makePostRequest(`http://localhost/api/stories/${STORY_ID}/poker`, {}),
      makeContext({ storyId: STORY_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/poker/:sessionId/vote — oddaja ocene (#12) ────────────────────

describe("POST /api/poker/:sessionId/vote — oddaja ocene (#12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  // DB calls (supabase):
  //   cnt=1: poker_sessions fetch  → maybeSingle
  //   cnt=2: project_members       → maybeSingle
  //   cnt=3: poker_votes check     → maybeSingle
  // Admin calls:
  //   cnt=1: poker_votes insert    → maybeSingle
  function setupVoteMocks(
    overrides: {
      session?: any;
      membership?: any;
      existingVote?: any;
      insertResult?: any;
    } = {},
  ) {
    const {
      session = activeSession,
      membership = scrumMasterMembership,
      existingVote = null,
      insertResult = {
        data: {
          id: "vote-1",
          session_id: SESSION_ID,
          user_id: USER_ID,
          round_number: 1,
          estimate: 5,
        },
        error: null,
      },
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: session, error: null });
      if (cnt === 2) return makeChain({ data: membership, error: null });
      if (cnt === 3) return makeChain({ data: existingVote, error: null });
      return makeChain({ data: null, error: null });
    });

    mockAdminFrom.mockImplementation(() => makeChain(insertResult));
  }

  // AC1 – regularen potek
  it("201 — scrum master uspešno odda oceno", async () => {
    setupVoteMocks();
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.estimate).toBe(5);
  });

  it("201 — developer uspešno odda oceno", async () => {
    setupVoteMocks({ membership: developerMembership });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 8,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(201);
  });

  it("201 — veljavna ocena '?' (-1)", async () => {
    setupVoteMocks();
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: -1,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(201);
  });

  // AC2 – vidnost ocen / validacija
  it("400 — uporabnik je že glasoval v tem krogu", async () => {
    setupVoteMocks({ existingVote: { id: "vote-existing" } });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/že glasoval/i);
  });

  it("400 — neveljavna ocena (ni v Fibonacci nizu)", async () => {
    setupVoteMocks();
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 4,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/neveljavna ocena/i);
  });

  it("400 — seja ni aktivna", async () => {
    setupVoteMocks({ session: completedSession });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ni aktivna/i);
  });

  it("403 — neuporabnik projekta ne more glasovati", async () => {
    setupVoteMocks({ membership: null });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/član projekta/i);
  });

  it("404 — seja ne obstaja", async () => {
    setupVoteMocks({ session: null });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/ne obstaja/i);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await postVote(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/vote`, {
        estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/poker/:sessionId — stanje igre (#12) ───────────────────────────

describe("GET /api/poker/:sessionId — stanje igre (#12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  // DB calls (supabase):
  //   cnt=1: poker_sessions fetch    → maybeSingle
  //   cnt=2: project_members (self)  → maybeSingle
  //   cnt=3: project_members (all)   → thenable
  //   cnt=4: poker_votes current     → thenable
  //   cnt=5: poker_votes all history → thenable
  function setupGetStateMocks(
    overrides: {
      session?: any;
      membership?: any;
      members?: any[];
      currentVotes?: any[];
      allVotes?: any[];
    } = {},
  ) {
    const {
      session = activeSession,
      membership = scrumMasterMembership,
      members = allMembers.map((m) => ({
        ...m,
        user: {
          id: m.user_id,
          first_name: "A",
          last_name: "B",
          email: "a@b.com",
        },
      })),
      currentVotes = [],
      allVotes = [],
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: session, error: null });
      if (cnt === 2) return makeChain({ data: membership, error: null });
      if (cnt === 3) return makeChain({ data: members, error: null });
      if (cnt === 4) return makeChain({ data: currentVotes, error: null });
      if (cnt === 5) return makeChain({ data: allVotes, error: null });
      return makeChain({ data: null, error: null });
    });
  }

  // AC1 – regularen potek
  it("200 — vrne stanje seje z informacijo kdo je glasoval", async () => {
    setupGetStateMocks();
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("session");
    expect(body).toHaveProperty("members");
    expect(body).toHaveProperty("all_voted");
    expect(body).toHaveProperty("my_vote");
  });

  // AC2 – vidnost ocen: ocene skrije dokler vsi ne glasujejo
  it("200 — ocene so skrite ko niso vsi glasovali", async () => {
    // Samo SM je glasoval, DEV še ne
    setupGetStateMocks({
      currentVotes: [{ user_id: USER_ID, estimate: 5 }],
    });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.all_voted).toBe(false);
    // Ocene morajo biti null
    body.members.forEach((m: any) => {
      expect(m.estimate).toBeNull();
    });
  });

  it("200 — ocene so vidne ko so vsi glasovali", async () => {
    setupGetStateMocks({
      currentVotes: [
        { user_id: USER_ID, estimate: 5 },
        { user_id: DEV_ID, estimate: 8 },
      ],
    });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.all_voted).toBe(true);
    const smMember = body.members.find((m: any) => m.user_id === USER_ID);
    expect(smMember.estimate).toBe(5);
  });

  // AC3 – pravilno sosledje krogov: suggested_estimate po krogu 3 ali enaki glasovi
  it("200 — predlaga oceno ko so vsi glasovali z enako oceno", async () => {
    setupGetStateMocks({
      currentVotes: [
        { user_id: USER_ID, estimate: 5 },
        { user_id: DEV_ID, estimate: 5 },
      ],
    });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggested_estimate).toBe(5);
  });

  it("200 — predlaga mediano po 3. krogu", async () => {
    setupGetStateMocks({
      session: { ...activeSession, current_round: 3 },
      currentVotes: [
        { user_id: USER_ID, estimate: 5 },
        { user_id: DEV_ID, estimate: 8 },
      ],
    });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggested_estimate).not.toBeNull();
  });

  it("200 — brez predloga v krogu 1 ko glasovi niso enaki", async () => {
    setupGetStateMocks({
      currentVotes: [
        { user_id: USER_ID, estimate: 5 },
        { user_id: DEV_ID, estimate: 8 },
      ],
    });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    const body = await res.json();
    expect(body.suggested_estimate).toBeNull();
  });

  it("403 — neuporabnik projekta ne more videti stanja", async () => {
    setupGetStateMocks({ membership: null });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(403);
  });

  it("404 — seja ne obstaja", async () => {
    setupGetStateMocks({ session: null });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(404);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await getSessionState(
      makeGetRequest(`http://localhost/api/poker/${SESSION_ID}`),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/poker/:sessionId/next-round — nov krog (#12) ──────────────────

describe("POST /api/poker/:sessionId/next-round — nov krog (#12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  // DB calls (supabase):
  //   cnt=1: poker_sessions fetch    → maybeSingle
  //   cnt=2: project_members (self)  → maybeSingle
  //   cnt=3: project_members (all)   → thenable
  //   cnt=4: poker_votes current     → thenable
  // Admin calls:
  //   cnt=1: poker_sessions update   → maybeSingle
  function setupNextRoundMocks(
    overrides: {
      session?: any;
      membership?: any;
      members?: any[];
      currentVotes?: any[];
      updateResult?: any;
    } = {},
  ) {
    const {
      session = activeSession,
      membership = scrumMasterMembership,
      members = allMembers,
      currentVotes = allVotedCurrentRound,
      updateResult = {
        data: { ...activeSession, current_round: 2 },
        error: null,
      },
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: session, error: null });
      if (cnt === 2) return makeChain({ data: membership, error: null });
      if (cnt === 3) return makeChain({ data: members, error: null });
      if (cnt === 4) return makeChain({ data: currentVotes, error: null });
      return makeChain({ data: null, error: null });
    });

    mockAdminFrom.mockImplementation(() => makeChain(updateResult));
  }

  // AC1 – regularen potek
  it("200 — scrum master uspešno začne nov krog ko so vsi glasovali", async () => {
    setupNextRoundMocks();
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current_round).toBe(2);
  });

  // AC3 – pravilno sosledje krogov
  it("400 — nov krog ni mogoč ko niso vsi glasovali", async () => {
    setupNextRoundMocks({
      currentVotes: [{ user_id: USER_ID }], // DEV ni glasoval
    });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/niso vsi/i);
  });

  it("400 — maksimalno število krogov (3) je doseženo", async () => {
    setupNextRoundMocks({
      session: { ...activeSession, current_round: 3 },
    });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/maksimalno/i);
  });

  it("400 — seja ni aktivna", async () => {
    setupNextRoundMocks({ session: completedSession });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ni aktivna/i);
  });

  it("403 — developer ne more začeti novega kroga", async () => {
    setupNextRoundMocks({ membership: developerMembership });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/skrbnik metodologije/i);
  });

  it("404 — seja ne obstaja", async () => {
    setupNextRoundMocks({ session: null });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(404);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await postNextRound(
      makePostRequest(
        `http://localhost/api/poker/${SESSION_ID}/next-round`,
        {},
      ),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/poker/:sessionId/complete — zaključek igre (#12) ──────────────

describe("POST /api/poker/:sessionId/complete — zaključek igre (#12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  // DB calls (supabase):
  //   cnt=1: poker_sessions fetch    → maybeSingle
  //   cnt=2: project_members (self)  → maybeSingle
  //   cnt=3: project_members (all)   → thenable
  //   cnt=4: poker_votes current     → thenable
  // Admin calls:
  //   cnt=1: poker_sessions update   → thenable (status=completed)
  //   cnt=2: user_stories update     → thenable (story_points)
  function setupCompleteMocks(
    overrides: {
      session?: any;
      membership?: any;
      members?: any[];
      currentVotes?: any[];
      sessionUpdateError?: any;
      storyUpdateError?: any;
    } = {},
  ) {
    const {
      session = activeSession,
      membership = scrumMasterMembership,
      members = allMembers,
      currentVotes = allVotedCurrentRound,
      sessionUpdateError = null,
      storyUpdateError = null,
    } = overrides;

    let cnt = 0;
    mockFrom.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return makeChain({ data: session, error: null });
      if (cnt === 2) return makeChain({ data: membership, error: null });
      if (cnt === 3) return makeChain({ data: members, error: null });
      if (cnt === 4) return makeChain({ data: currentVotes, error: null });
      return makeChain({ data: null, error: null });
    });

    let adminCnt = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCnt++;
      if (adminCnt === 1)
        return makeChain({ data: null, error: sessionUpdateError });
      return makeChain({ data: null, error: storyUpdateError });
    });
  }

  // AC1 + AC4 – regularen potek + vpis končne ocene
  it("200 — scrum master uspešno zaključi sejo z veljavno oceno", async () => {
    setupCompleteMocks();
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.final_estimate).toBe(5);
    expect(body.message).toMatch(/zaključena/i);
  });

  it("200 — veljavna ocena 0", async () => {
    setupCompleteMocks();
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 0,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
  });

  // AC4 – vpis končne ocene: admin kliče posodobitev story_points
  it("posodobi story_points na zgodbi po zaključku", async () => {
    setupCompleteMocks();
    await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 8,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    // admin update za user_stories mora biti klican
    expect(mockAdminFrom).toHaveBeenCalledTimes(2);
    const calls = mockAdminFrom.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContain("user_stories");
    expect(calls).toContain("poker_sessions");
  });

  it("400 — neveljavna končna ocena (negativna)", async () => {
    setupCompleteMocks();
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: -5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/neveljavna končna ocena/i);
  });

  it("400 — manjkajoča končna ocena", async () => {
    setupCompleteMocks();
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {}),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — niso vsi glasovali pred zaključkom", async () => {
    setupCompleteMocks({
      currentVotes: [{ user_id: USER_ID }], // DEV ni glasoval
    });
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/niso vsi/i);
  });

  it("400 — seja ni aktivna", async () => {
    setupCompleteMocks({ session: completedSession });
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ni aktivna/i);
  });

  it("403 — developer ne more zaključiti seje", async () => {
    setupCompleteMocks({ membership: developerMembership });
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/skrbnik metodologije/i);
  });

  it("404 — seja ne obstaja", async () => {
    setupCompleteMocks({ session: null });
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(404);
  });

  it("401 — neprijavljen uporabnik", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await postComplete(
      makePostRequest(`http://localhost/api/poker/${SESSION_ID}/complete`, {
        final_estimate: 5,
      }),
      makeContext({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(401);
  });
});
