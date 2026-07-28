"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/utils";
import type { AdminCategoryNode } from "@/server/services/admin/category";
import { deleteCategoryAction, reorderCategoriesAction } from "../_actions";
import { CategoryFormDialog } from "./category-form-dialog";

/**
 * CategoryTree — the whole interactive body of `/admin/categories`.
 * Native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/
 * `onDrop`), not a library: no drag-and-drop package was already
 * installed (`package.json` has none), and adding one mid-build would
 * need a registry fetch this sandbox can't reliably make (the same
 * network wall `next/font` hits — see PROGRESS.md). This is a real,
 * working reorder, just without a library's animation polish.
 *
 * One form dialog and one delete-confirm dialog are mounted ONCE here,
 * at the top, and reused for every row in the tree (`formTarget`/
 * `deleteTarget` state below select what they're currently pointed at) —
 * not one dialog instance per row, which would mount potentially dozens
 * of `Dialog`s for a deep category tree.
 */
export interface CategoryTreeProps {
  tree: AdminCategoryNode[];
}

interface FormTarget {
  parentId: string | null;
  category?: AdminCategoryNode;
}

export function CategoryTree({ tree }: CategoryTreeProps) {
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryNode | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleteTransition(async () => {
      const result = await deleteCategoryAction(target.id);
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete this category.");
        return;
      }
      toast(`Deleted "${target.name}".`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setFormTarget({ parentId: null })}>
          <Plus />
          Add a category
        </Button>
      </div>

      {tree.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">
          You haven&rsquo;t added any categories yet.
        </p>
      ) : (
        <CategoryLevel
          nodes={tree}
          parentId={null}
          depth={0}
          onAddChild={(parentId) => setFormTarget({ parentId })}
          // `parentId: null` here is inert — `CategoryFormDialog` only
          // reads `parentId` when `category` is absent (create mode).
          onEdit={(category) => setFormTarget({ parentId: null, category })}
          onDelete={setDeleteTarget}
        />
      )}

      <CategoryFormDialog
        open={formTarget !== null}
        onOpenChange={(open) => !open && setFormTarget(null)}
        parentId={formTarget?.parentId ?? null}
        category={formTarget?.category}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this category?"
        itemName={deleteTarget?.name ?? ""}
        consequence="This can't be undone. Categories with products or sub-categories inside them can't be deleted."
        confirmLabel={isDeleting ? "Deleting…" : "Yes, delete it"}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
}

interface CategoryLevelProps {
  nodes: AdminCategoryNode[];
  parentId: string | null;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (category: AdminCategoryNode) => void;
  onDelete: (category: AdminCategoryNode) => void;
}

function CategoryLevel({
  nodes,
  parentId,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: CategoryLevelProps) {
  const [order, setOrder] = useState<string[]>(() => nodes.map((node) => node.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Re-sync whenever fresh server data flows down (after any mutation's
  // `router.refresh()`) — this level's own drag state must not keep
  // showing a stale order once the server has a new one.
  useEffect(() => {
    setOrder(nodes.map((node) => node.id));
  }, [nodes]);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const orderedNodes = order
    .map((id) => nodesById.get(id))
    .filter((node): node is AdminCategoryNode => Boolean(node));

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const previousOrder = order;
    const nextOrder = [...order];
    const fromIndex = nextOrder.indexOf(draggedId);
    const toIndex = nextOrder.indexOf(targetId);
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggedId);
    setOrder(nextOrder);
    setDraggedId(null);

    startTransition(async () => {
      const result = await reorderCategoriesAction({ parentId, orderedIds: nextOrder });
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't save the new order.");
        setOrder(previousOrder);
        return;
      }
      router.refresh();
    });
  }

  return (
    <ul
      className={cn("flex flex-col gap-1", depth > 0 && "ml-6 border-l border-glass-stroke pl-4")}
    >
      {orderedNodes.map((node) => (
        <li key={node.id}>
          <div
            draggable
            onDragStart={() => setDraggedId(node.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(node.id)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded border border-glass-stroke bg-surface-container px-2",
              draggedId === node.id && "opacity-50",
            )}
          >
            <GripVertical
              className="size-4 shrink-0 cursor-grab text-on-surface-variant"
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-body-md text-on-surface">{node.name}</span>
            {!node.isActive && <Badge variant="warning">Not published yet</Badge>}
            <Badge variant="glass">
              {node.productCount} product{node.productCount === 1 ? "" : "s"}
            </Badge>
            <Button
              variant="icon"
              size="sm"
              iconOnly
              aria-label={`Add a category inside ${node.name}`}
              onClick={() => onAddChild(node.id)}
            >
              <Plus />
            </Button>
            <Button
              variant="icon"
              size="sm"
              iconOnly
              aria-label={`Edit ${node.name}`}
              onClick={() => onEdit(node)}
            >
              <Pencil />
            </Button>
            <Button
              variant="icon"
              size="sm"
              iconOnly
              aria-label={`Delete ${node.name}`}
              onClick={() => onDelete(node)}
            >
              <Trash2 />
            </Button>
          </div>

          {node.children.length > 0 && (
            <CategoryLevel
              nodes={node.children}
              parentId={node.id}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
