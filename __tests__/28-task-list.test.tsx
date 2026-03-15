/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import TaskList from "@/components/features/board/TaskList";

jest.mock("@/components/features/board/TaskItem", () => {
  return function MockTaskItem({ task }: any) {
    return (
      <div data-testid="task-item">
        {task.title} | {task.status} | accepted:{String(task.is_accepted)} | assignee:
        {task.assignee_id ?? "none"}
      </div>
    );
  };
});

function normalize(text?: string | null) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function getCategoryHeader(label: string, count: number) {
  const matches = screen.getAllByText((_, el) => {
    if (!el || el.tagName.toLowerCase() !== "span") return false;
    return normalize(el.textContent) === `${label} (${count})`;
  });

  return matches[0];
}

function queryCategoryHeader(label: string, count: number) {
  const matches = screen.queryAllByText((_, el) => {
    if (!el || el.tagName.toLowerCase() !== "span") return false;
    return normalize(el.textContent) === `${label} (${count})`;
  });

  return matches[0] ?? null;
}

describe("TaskList", () => {
  const defaultProps = {
    currentUserId: "user-1",
    canAccept: true,
    updatingTaskId: null,
    onAccept: jest.fn(),
    onResign: jest.fn(),
    onUpdateStatus: jest.fn(),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pravilno razvrsti naloge v kategorije: active, assigned, unassigned, done", () => {
    const tasks = [
      {
        id: "1",
        title: "Aktivna naloga",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
      {
        id: "2",
        title: "Dodeljena naloga",
        status: "todo",
        is_accepted: true,
        assignee_id: "dev-2",
      },
      {
        id: "3",
        title: "Nedodeljena naloga",
        status: "todo",
        is_accepted: false,
        assignee_id: null,
      },
      {
        id: "4",
        title: "Zaključena naloga",
        status: "completed",
        is_accepted: true,
        assignee_id: "dev-3",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Active", 1)).toBeTruthy();
    expect(getCategoryHeader("Assigned", 1)).toBeTruthy();
    expect(getCategoryHeader("Unassigned", 1)).toBeTruthy();
    expect(getCategoryHeader("Done", 1)).toBeTruthy();

    expect(screen.getByText(/Aktivna naloga/)).toBeTruthy();
    expect(screen.getByText(/Dodeljena naloga/)).toBeTruthy();
    expect(screen.getByText(/Nedodeljena naloga/)).toBeTruthy();
    expect(screen.getByText(/Zaključena naloga/)).toBeTruthy();
  });

  it("pravilno klasificira nalogo brez assignee in brez accepted kot unassigned", () => {
    const tasks = [
      {
        id: "1",
        title: "Task A",
        status: "todo",
        is_accepted: false,
        assignee_id: null,
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Unassigned", 1)).toBeTruthy();
    expect(queryCategoryHeader("Assigned", 1)).toBeNull();
    expect(queryCategoryHeader("Active", 1)).toBeNull();
    expect(queryCategoryHeader("Done", 1)).toBeNull();
  });

  it("pravilno klasificira accepted + assignee kot assigned", () => {
    const tasks = [
      {
        id: "1",
        title: "Task B",
        status: "todo",
        is_accepted: true,
        assignee_id: "dev-1",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Assigned", 1)).toBeTruthy();
    expect(queryCategoryHeader("Unassigned", 1)).toBeNull();
    expect(queryCategoryHeader("Active", 1)).toBeNull();
    expect(queryCategoryHeader("Done", 1)).toBeNull();
  });

  it("pravilno klasificira in_progress kot active", () => {
    const tasks = [
      {
        id: "1",
        title: "Task C",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Active", 1)).toBeTruthy();
    expect(queryCategoryHeader("Assigned", 1)).toBeNull();
    expect(queryCategoryHeader("Unassigned", 1)).toBeNull();
    expect(queryCategoryHeader("Done", 1)).toBeNull();
  });

  it("pravilno klasificira completed kot done", () => {
    const tasks = [
      {
        id: "1",
        title: "Task D",
        status: "completed",
        is_accepted: true,
        assignee_id: "dev-1",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Done", 1)).toBeTruthy();
    expect(queryCategoryHeader("Active", 1)).toBeNull();
    expect(queryCategoryHeader("Assigned", 1)).toBeNull();
    expect(queryCategoryHeader("Unassigned", 1)).toBeNull();
  });

  it("prikaže kategorije v pravilnem vrstnem redu: active, assigned, unassigned, done", () => {
    const tasks = [
      {
        id: "1",
        title: "Task active",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
      {
        id: "2",
        title: "Task assigned",
        status: "todo",
        is_accepted: true,
        assignee_id: "dev-2",
      },
      {
        id: "3",
        title: "Task unassigned",
        status: "todo",
        is_accepted: false,
        assignee_id: null,
      },
      {
        id: "4",
        title: "Task done",
        status: "completed",
        is_accepted: true,
        assignee_id: "dev-3",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    const allHeaders = screen.getAllByText((_, el) => {
      if (!el || el.tagName.toLowerCase() !== "span") return false;
      const text = normalize(el.textContent);
      return (
        text === "Active (1)" ||
        text === "Assigned (1)" ||
        text === "Unassigned (1)" ||
        text === "Done (1)"
      );
    });

    expect(normalize(allHeaders[0].textContent)).toBe("Active (1)");
    expect(normalize(allHeaders[1].textContent)).toBe("Assigned (1)");
    expect(normalize(allHeaders[2].textContent)).toBe("Unassigned (1)");
    expect(normalize(allHeaders[3].textContent)).toBe("Done (1)");
  });

  it("v legendi pravilno prikaže število nalog po kategorijah", () => {
    const tasks = [
      {
        id: "1",
        title: "Task 1",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
      {
        id: "2",
        title: "Task 2",
        status: "todo",
        is_accepted: true,
        assignee_id: "dev-2",
      },
      {
        id: "3",
        title: "Task 3",
        status: "todo",
        is_accepted: false,
        assignee_id: null,
      },
      {
        id: "4",
        title: "Task 4",
        status: "completed",
        is_accepted: true,
        assignee_id: "dev-3",
      },
      {
        id: "5",
        title: "Task 5",
        status: "completed",
        is_accepted: true,
        assignee_id: "dev-4",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();

    expect(getCategoryHeader("Active", 1)).toBeTruthy();
    expect(getCategoryHeader("Assigned", 1)).toBeTruthy();
    expect(getCategoryHeader("Unassigned", 1)).toBeTruthy();
    expect(getCategoryHeader("Done", 2)).toBeTruthy();
  });

  it("ne prikaže sekcij za prazne kategorije", () => {
    const tasks = [
      {
        id: "1",
        title: "Samo aktivna",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(getCategoryHeader("Active", 1)).toBeTruthy();

    expect(queryCategoryHeader("Assigned", 1)).toBeNull();
    expect(queryCategoryHeader("Unassigned", 1)).toBeNull();
    expect(queryCategoryHeader("Done", 1)).toBeNull();

    // legenda ostane prisotna
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("prikaže vse task iteme", () => {
    const tasks = [
      {
        id: "1",
        title: "Task 1",
        status: "in_progress",
        is_accepted: true,
        assignee_id: "dev-1",
      },
      {
        id: "2",
        title: "Task 2",
        status: "todo",
        is_accepted: true,
        assignee_id: "dev-2",
      },
      {
        id: "3",
        title: "Task 3",
        status: "todo",
        is_accepted: false,
        assignee_id: null,
      },
    ];

    render(<TaskList tasks={tasks as any} {...defaultProps} />);

    expect(screen.getAllByTestId("task-item")).toHaveLength(3);
  });

  it("vrne prazen prikaz kategorij, če ni nalog", () => {
    render(<TaskList tasks={[]} {...defaultProps} />);

    expect(screen.queryByTestId("task-item")).toBeNull();

    expect(queryCategoryHeader("Active", 1)).toBeNull();
    expect(queryCategoryHeader("Assigned", 1)).toBeNull();
    expect(queryCategoryHeader("Unassigned", 1)).toBeNull();
    expect(queryCategoryHeader("Done", 1)).toBeNull();

    // legenda ostane vidna z ničlami
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });
});