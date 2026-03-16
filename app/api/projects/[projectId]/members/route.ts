import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageProjectMembers } from "@/lib/permissions";
import type { ProjectRole } from "@/lib/types";

const VALID_ROLES: ProjectRole[] = ["product_owner", "scrum_master", "developer"];

interface MemberInput {
  user_id: string;
  role: ProjectRole;
}

/**
 * @swagger
 * /api/projects/{projectId}/members:
 *   get:
 *     summary: Get all project members
 *     description: Returns all members of a project along with their user details and project role.
 *     tags:
 *       - Members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: List of project members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: "e5f6a7b8-c9d0-1234-efab-567890123456"
 *                   project_id:
 *                     type: string
 *                     format: uuid
 *                     example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   user_id:
 *                     type: string
 *                     format: uuid
 *                     example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                   role:
 *                     type: string
 *                     enum: [product_owner, scrum_master, developer]
 *                     example: "developer"
 *                   user:
 *                     $ref: '#/components/schemas/UserSummary'
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Projekt ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri pridobivanju članov."
 *
 * components:
 *   schemas:
 *     UserSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *         email:
 *           type: string
 *           format: email
 *           example: "janez.novak@example.com"
 *         username:
 *           type: string
 *           example: "janez.novak"
 *         first_name:
 *           type: string
 *           example: "Janez"
 *         last_name:
 *           type: string
 *           example: "Novak"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Projekt ne obstaja." }, { status: 404 });
    }

    const { data: members, error } = await supabase
      .from("project_members")
      .select(`
        *,
        user:users(id, email, username, first_name, last_name)
      `)
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members);
  } catch {
    return NextResponse.json(
      { error: "Napaka pri pridobivanju članov." },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/projects/{projectId}/members:
 *   post:
 *     summary: Add members to project
 *     description: >
 *       Bulk-adds one or more users to a project with specified roles.
 *       Only users with member management permissions can perform this action.
 *       All inserts are atomic — if any fail, none are added.
 *     tags:
 *       - Members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the project
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - members
 *             properties:
 *               members:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - user_id
 *                     - role
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                       example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                     role:
 *                       type: string
 *                       enum: [product_owner, scrum_master, developer]
 *                       example: "developer"
 *     responses:
 *       201:
 *         description: Members successfully added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Uspešno dodanih 2 članov."
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "e5f6a7b8-c9d0-1234-efab-567890123456"
 *                       project_id:
 *                         type: string
 *                         format: uuid
 *                         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                         example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                       role:
 *                         type: string
 *                         enum: [product_owner, scrum_master, developer]
 *                         example: "developer"
 *                       user:
 *                         $ref: '#/components/schemas/UserSummary'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     emptyList:
 *                       value: "Seznam članov je obvezen."
 *                     duplicates:
 *                       value: "Seznam vsebuje podvojene uporabnike."
 *                     invalidRole:
 *                       value: "Neveljavna vloga: manager. Veljavne vloge so: product_owner, scrum_master, developer"
 *                     missingUsers:
 *                       value: "Naslednji uporabniki ne obstajajo: d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                     alreadyMembers:
 *                       value: "Naslednji uporabniki so že člani projekta: janez.novak"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: User does not have permission to manage members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nimaš pravic za upravljanje članov tega projekta."
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Projekt ne obstaja."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Napaka pri obdelavi zahteve."
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageProjectMembers(user.id, projectId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Nimaš pravic za upravljanje članov tega projekta." },
        { status: 403 }
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Projekt ne obstaja." }, { status: 404 });
    }

    const body = await request.json();
    const { members } = body as { members: MemberInput[] };

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Seznam članov je obvezen." },
        { status: 400 }
      );
    }

    const userIds = members.map((m) => m.user_id);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      return NextResponse.json(
        { error: "Seznam vsebuje podvojene uporabnike." },
        { status: 400 }
      );
    }

    for (const member of members) {
      if (!VALID_ROLES.includes(member.role)) {
        return NextResponse.json(
          { error: `Neveljavna vloga: ${member.role}. Veljavne vloge so: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const { data: existingUsers } = await supabase
      .from("users")
      .select("id")
      .in("id", userIds);

    const existingUserIds = new Set(existingUsers?.map((u) => u.id) || []);
    const missingUsers = userIds.filter((id) => !existingUserIds.has(id));

    if (missingUsers.length > 0) {
      return NextResponse.json(
        { error: `Naslednji uporabniki ne obstajajo: ${missingUsers.join(", ")}` },
        { status: 400 }
      );
    }

    const { data: existingMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .in("user_id", userIds);

    const alreadyMembers = existingMembers?.map((m) => m.user_id) || [];
    if (alreadyMembers.length > 0) {
      const { data: alreadyMemberUsers } = await supabase
        .from("users")
        .select("username")
        .in("id", alreadyMembers);

      const usernames = alreadyMemberUsers?.map((u) => u.username).join(", ");
      return NextResponse.json(
        { error: `Naslednji uporabniki so že člani projekta: ${usernames}` },
        { status: 400 }
      );
    }

    const memberInserts = members.map((member) => ({
      project_id: projectId,
      user_id: member.user_id,
      role: member.role,
    }));

    const { data: insertedMembers, error: insertError } = await supabase
      .from("project_members")
      .insert(memberInserts)
      .select(`
        *,
        user:users(id, email, username, first_name, last_name)
      `);

    if (insertError) {
      return NextResponse.json(
        { error: "Napaka pri dodajanju članov: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Uspešno dodanih ${insertedMembers.length} članov.`,
        members: insertedMembers,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error adding members:", err);
    return NextResponse.json(
      { error: "Napaka pri obdelavi zahteve." },
      { status: 500 }
    );
  }
}