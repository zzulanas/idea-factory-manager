"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { ReviewDashboard } from "@/components/ReviewDashboard";
import { ReviewWorkflow } from "@/components/ReviewWorkflow";
import { trpc } from "@/lib/trpc/client";
import { useState, useEffect } from "react";
import { Clock, RotateCw, CheckCircle, XCircle, Ban, Factory, Eye } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  running: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  completed: "bg-green-500/20 text-green-600 border-green-500/30",
  failed: "bg-red-500/20 text-red-600 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-600 border-gray-500/30",
  review: "bg-orange-500/20 text-orange-600 border-orange-500/30",
};

const statusIcons = {
  pending: Clock,
  running: RotateCw,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
  review: Eye,
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'review'>('tasks');

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery(undefined, {
    enabled: !isSearching
  });
  const { data: searchResults, isLoading: isSearchLoading } = trpc.tasks.search.useQuery(
    { query: searchQuery },
    { enabled: isSearching && searchQuery.length > 0 }
  );
  const { data: projects, isLoading: projectsLoading } = trpc.dokploy.getProjects.useQuery();
  const { data: reviewTasks } = trpc.tasks.getReviewTasks.useQuery();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      setTitle("");
      setPrompt("");
    },
  });

  const createProject = trpc.dokploy.createProject.useMutation({
    onSuccess: (newProject) => {
      utils.dokploy.getProjects.invalidate();
      setSelectedProject(newProject.projectId);
      setShowNewProject(false);
      setNewProjectName("");
    },
  });

  const cancelTask = trpc.tasks.cancel.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  // Get the selected project's local path for the agent runner
  const getProjectPath = () => {
    if (!selectedProject || !projects) return "";
    const project = projects.find((p) => p.projectId === selectedProject);
    if (!project) return "";
    // Use local path - extract project name from the first app's git URL or project name
    const app = project.applications[0];
    // Extract repo name from git URL like "https://github.com/zzulanas/idea-factory-template.git"
    const repoName = app?.gitUrl?.match(/\/([^/]+?)(?:\.git)?$/)?.[1] || project.name.toLowerCase().replace(/\s+/g, '-');
    return `/home/zzula/projects/${repoName}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim() || !selectedProject) return;
    createTask.mutate({ title, prompt, projectPath: getProjectPath() });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProject.mutate({ name: newProjectName });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        // Only submit if form is valid
        if (title.trim() && prompt.trim() && selectedProject && !createTask.isPending) {
          createTask.mutate({ title, prompt, projectPath: getProjectPath() });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [title, prompt, selectedProject, createTask]);

  const displayTasks = isSearching ? searchResults : tasks;
  const displayLoading = isSearching ? isSearchLoading : isLoading;

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="glass" className="mb-4 px-4 py-1.5">
            <Icon icon={Factory} className="mr-2" />
            Idea Factory Manager
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Background <span className="font-mono">Agent Tasks</span>
          </h1>
          <p className="text-muted-foreground">
            Queue coding tasks for the OpenCode agent to execute in the background
          </p>
        </div>

        {/* Create Task Form */}
        <Card variant="glass" className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">New Task</CardTitle>
            <CardDescription>Create a new task for the agent to work on</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  variant="glass"
                  placeholder="Task title (e.g., Add dark mode toggle)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <textarea
                  className="w-full min-h-[100px] glass glass-border rounded-xl p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Describe what you want the agent to do..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Target Project
                </label>
                {showNewProject ? (
                  <div className="flex gap-2">
                    <Input
                      variant="glass"
                      placeholder="New project name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="gradient"
                      size="sm"
                      onClick={handleCreateProject}
                      disabled={createProject.isPending || !newProjectName.trim()}
                    >
                      {createProject.isPending ? "..." : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewProject(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 h-10 glass glass-border rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-transparent"
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      disabled={projectsLoading}
                    >
                      <option value="">
                        {projectsLoading ? "Loading projects..." : "Select a project"}
                      </option>
                      {projects?.map((project) => (
                        <option key={project.projectId} value={project.projectId}>
                          {project.name} {project.applications.length > 0 ? `(${project.applications.length} apps)` : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewProject(true)}
                    >
                      + New
                    </Button>
                  </div>
                )}
                {selectedProject && projects && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Path: {getProjectPath()}
                  </p>
                )}
              </div>
              <Button
                variant="gradient"
                type="submit"
                disabled={createTask.isPending || !title.trim() || !prompt.trim() || !selectedProject}
                className="flex items-center gap-2"
              >
                {createTask.isPending ? "Creating..." : "Create Task"}
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>G
                </kbd>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'tasks' ? 'default' : 'outline'}
            onClick={() => setActiveTab('tasks')}
            className="flex items-center gap-2"
          >
            <Factory className="h-4 w-4" />
            All Tasks
            {displayTasks && <Badge variant="secondary" className="ml-1">{displayTasks.length}</Badge>}
          </Button>
          <Button
            variant={activeTab === 'review' ? 'default' : 'outline'}
            onClick={() => setActiveTab('review')}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Review Queue
            {reviewTasks && reviewTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-800">
                {reviewTasks.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'review' ? (
          <ReviewDashboard />
        ) : (
          <>
        {/* Task List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <div className="flex items-center gap-2">
              <Input
                variant="glass"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Badge variant="outline">{displayTasks?.length ?? 0} {isSearching ? 'found' : 'total'}</Badge>
            </div>
          </div>

          {displayLoading ? (
            <Card variant="glass-subtle">
              <CardContent className="py-8 text-center text-muted-foreground">
                {isSearching ? 'Searching...' : 'Loading tasks...'}
              </CardContent>
            </Card>
          ) : displayTasks?.length === 0 ? (
            <Card variant="glass-subtle">
              <CardContent className="py-8 text-center text-muted-foreground">
                {isSearching ? 'No tasks found matching your search.' : 'No tasks yet. Create one above!'}
              </CardContent>
            </Card>
          ) : (
            displayTasks?.map((task) => (
              <Card key={task.id} variant="glass">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <Icon icon={statusIcons[task.status]} className="h-4 w-4 shrink-0" />
                        <CardTitle className="text-lg truncate min-w-0 flex-1">{task.title}</CardTitle>
                        <Badge className={`${statusColors[task.status]} shrink-0 sm:hidden text-[10px] px-2 py-0.5`}>{task.status}</Badge>
                      </div>
                      <CardDescription className="line-clamp-2 break-words">{task.prompt}</CardDescription>
                    </div>
                    <Badge className={`${statusColors[task.status]} shrink-0 hidden sm:inline-flex`}>{task.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs text-muted-foreground">
                    <span className="truncate max-w-full sm:max-w-[50%]">{task.projectPath}</span>
                    <span className="shrink-0">{new Date(task.createdAt).toLocaleString()}</span>
                  </div>
                  {task.error && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600">
                      {task.error}
                    </div>
                  )}
                  {task.output && task.status === "completed" && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        View output
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg glass text-xs overflow-x-auto max-h-48 overflow-y-auto">
                        {task.output}
                      </pre>
                    </details>
                  )}
                  
                  {/* Review Workflow Component */}
                  {task.status === 'review' && (
                    <div className="mt-4">
                      <ReviewWorkflow
                        taskId={task.id}
                        status={task.status}
                        previewUrl={task.previewUrl}
                        branchName={task.branchName}
                        prUrl={task.prUrl}
                        onStatusChange={() => {
                          utils.tasks.list.invalidate();
                          utils.tasks.getReviewTasks.invalidate();
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    {task.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelTask.mutate({ id: task.id })}
                        disabled={cancelTask.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTask.mutate({ id: task.id })}
                        disabled={deleteTask.isPending}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        </>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-xs text-muted-foreground">
            Agent runner: <code className="glass px-2 py-1 rounded">npx tsx scripts/agent-runner.ts</code>
          </p>
        </div>
      </main>
    </div>
  );
}
