"use client";

import { useState } from "react";
import { createApiKey, deleteApiKey } from "@/app/dashboard/api-keys/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyIcon, CheckIcon, TrashIcon, PlusIcon } from "lucide-react";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeysListProps {
  apiKeys: ApiKey[];
}

export function ApiKeysList({ apiKeys }: ApiKeysListProps) {
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    try {
      const result = await createApiKey(formData);
      if (result.error) {
        console.error("Failed to create key:", result.error);
        return;
      }
      if (result.key) {
        setCreatedKey(result.key);
        setCreateOpen(false);
      }
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(keyId: string) {
    setDeleting(keyId);
    try {
      const formData = new FormData();
      formData.set("key_id", keyId);
      const result = await deleteApiKey(formData);
      if (result.error) {
        console.error("Failed to delete key:", result.error);
      }
      setDeleteOpen(null);
    } catch (err) {
      console.error("Failed to delete key:", err);
    } finally {
      setDeleting(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Show created key once */}
      {createdKey && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">
              API Key Created
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400">
              Save this key — you will not see it again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                {createdKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(createdKey)}
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setCreatedKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create key dialog */}
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button>
                <PlusIcon className="size-4" />
                Create API Key
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Give your key a name so you can identify it later.
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  name="name"
                  placeholder="e.g. Production server"
                  required
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys table */}
      {apiKeys.length === 0 && !createdKey ? (
        <p className="text-sm text-muted-foreground">
          No API keys yet. Create one to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {key.key_prefix}...
                  </Badge>
                </TableCell>
                <TableCell>{key.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.last_used_at)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.created_at)}
                </TableCell>
                <TableCell>
                  <Dialog
                    open={deleteOpen === key.id}
                    onOpenChange={(open) =>
                      setDeleteOpen(open ? key.id : null)
                    }
                  >
                    <DialogTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <TrashIcon className="size-4" />
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete API Key</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete the key &quot;{key.name}&quot;?
                          This action cannot be undone. Any integrations using
                          this key will stop working.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <Button
                          variant="destructive"
                          disabled={deleting === key.id}
                          onClick={() => handleDelete(key.id)}
                        >
                          {deleting === key.id ? "Deleting..." : "Delete"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
