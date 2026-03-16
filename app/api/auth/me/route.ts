import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the profile data of the currently logged-in user based on their session.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Successfully retrieved user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "d5e8f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "janez.novak@example.com"
 *                 first_name:
 *                   type: string
 *                   example: "Janez"
 *                 last_name:
 *                   type: string
 *                   example: "Novak"
 *                 system_role:
 *                   type: string
 *                   enum: [admin, user]
 *                   example: "user"
 *       401:
 *         description: User is not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: User not found in database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error fetching user."
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, system_role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !userData) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(userData);
  } catch {
    return NextResponse.json(
      { error: "Error fetching user." },
      { status: 500 }
    );
  }
}