import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canManageProjectMembers } from "@/lib/permissions";
import type { ProjectRole } from "@/lib/types";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_ROLES: ProjectRole[] = [
  "product_owner",
  "scrum_master",
  "developer",
];

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
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 *
 * components:
 *   schemas:
 *     UserSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    const { data: members, error } = await supabase
      .from("project_members")
      .select(
        `
        *,
        user:users(id, email, username, first_name, last_name)
      `,
      )
      .eq("project_id", projectId)
      .is("removed_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members);
  } catch {
    return NextResponse.json(
      { error: "Error fetching members." },
      { status: 500 },
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
 *       Previously removed members are restored instead of re-inserted.
 *     tags:
 *       - Members
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *                     role:
 *                       type: string
 *                       enum: [product_owner, scrum_master, developer]
 *     responses:
 *       201:
 *         description: Members successfully added
 *       400:
 *         description: Validation failed
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: User does not have permission
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageProjectMembers(user.id, projectId);
    if (!canManage) {
      return NextResponse.json(
        {
          error: "You don't have permission to manage members of this project.",
        },
        { status: 403 },
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { members } = body as { members: MemberInput[] };

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Member list is required." },
        { status: 400 },
      );
    }

    const userIds = members.map((m) => m.user_id);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      return NextResponse.json(
        { error: "The list contains duplicate users." },
        { status: 400 },
      );
    }

    for (const member of members) {
      if (!VALID_ROLES.includes(member.role)) {
        return NextResponse.json(
          {
            error: `Invalid role: ${member.role}. Valid roles are: ${VALID_ROLES.join(", ")}`,
          },
          { status: 400 },
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
        {
          error: `The following users do not exist: ${missingUsers.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Preveri samo AKTIVNE člane (removed_at IS NULL)
    const { data: existingMembers } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .in("user_id", userIds)
      .is("removed_at", null);

    const alreadyMembers = existingMembers?.map((m) => m.user_id) || [];
    if (alreadyMembers.length > 0) {
      const { data: alreadyMemberUsers } = await supabase
        .from("users")
        .select("username")
        .in("id", alreadyMembers);

      const usernames = alreadyMemberUsers?.map((u) => u.username).join(", ");
      return NextResponse.json(
        {
          error: `The following users are already members of this project: ${usernames}`,
        },
        { status: 400 },
      );
    }

    // Poišči soft-deletane člane (vrstica obstaja, ampak removed_at IS NOT NULL)
    const { data: softDeleted } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .in("user_id", userIds)
      .not("removed_at", "is", null);

    const softDeletedIds = new Set(softDeleted?.map((m) => m.user_id) ?? []);
    const toRestore = members.filter((m) => softDeletedIds.has(m.user_id));
    const toInsert = members.filter((m) => !softDeletedIds.has(m.user_id));

    // Soft-deletane OBNOVI z UPDATE — vzemi samo zadnjo vrstico (po joined_at DESC)
    const restorePromises = toRestore.map(async (m) => {
      // Poišči id zadnje soft-deleted vrstice za tega userja
      const { data: existing } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", m.user_id)
        .not("removed_at", "is", null)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existing)
        return { data: null, error: { message: "Row not found." } };

      return supabaseAdmin
        .from("project_members")
        .update({
          role: m.role,
          removed_at: null,
          joined_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select(`*, user:users(id, email, username, first_name, last_name)`)
        .maybeSingle();
    });

    const restoredResults = await Promise.all(restorePromises);

    const failedRestore = restoredResults.find((r) => r.error);
    if (failedRestore) {
      return NextResponse.json(
        { error: "Error restoring member: " + failedRestore.error!.message },
        { status: 500 },
      );
    }

    const restoredMembers = restoredResults.map((r) => r.data);

    // Nove člane VSTAVI z INSERT
    let insertedMembers: typeof restoredMembers = [];
    if (toInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from("project_members")
        .insert(
          toInsert.map((m) => ({
            project_id: projectId,
            user_id: m.user_id,
            role: m.role,
          })),
        )
        .select(`*, user:users(id, email, username, first_name, last_name)`);

      if (insertError) {
        return NextResponse.json(
          { error: "Error adding members: " + insertError.message },
          { status: 500 },
        );
      }
      insertedMembers = data ?? [];
    }

    const allMembers = [...restoredMembers, ...insertedMembers];

    return NextResponse.json(
      {
        message: `Successfully added ${allMembers.length} member(s).`,
        members: allMembers,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Error adding members:", err);
    return NextResponse.json(
      { error: "Error processing request." },
      { status: 500 },
    );
  }
}
