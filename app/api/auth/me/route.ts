import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pridobi dodatne podatke iz users tabele
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