import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const DOKPLOY_API_URL = process.env.DOKPLOY_API_URL || 'http://localhost:3000';
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY || '';

interface DokployProject {
  projectId: string;
  name: string;
  description: string | null;
}

interface DokployApplication {
  applicationId: string;
  name: string;
  appName: string;
  description: string | null;
  customGitUrl: string | null;
  repository: string | null;
  owner: string | null;
  buildPath: string | null;
  dockerfile: string | null;
}

interface DokployPreviewDeployment {
  deploymentId: string;
  applicationId: string;
  branch: string;
  commitHash: string;
  status: 'building' | 'running' | 'stopped' | 'error';
  url: string | null;
  createdAt: string;
}

interface DokployEnvironment {
  environmentId: string;
  name: string;
  applications: DokployApplication[];
}

interface DokployProjectWithApps extends DokployProject {
  environments: DokployEnvironment[];
}

async function dokployFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${DOKPLOY_API_URL}/api/trpc/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': DOKPLOY_API_KEY,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Dokploy API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result?.data?.json as T;
}

export const dokployRouter = router({
  // Get all projects with their applications
  getProjects: publicProcedure.query(async () => {
    const projects = await dokployFetch<DokployProjectWithApps[]>(
      'project.all?input=%7B%7D'
    );
    
    // Transform to a simpler structure for the UI
    return projects.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      description: project.description,
      applications: project.environments.flatMap((env) =>
        env.applications.map((app) => ({
          applicationId: app.applicationId,
          name: app.name,
          appName: app.appName,
          description: app.description,
          gitUrl: app.customGitUrl || (app.owner && app.repository ? `https://github.com/${app.owner}/${app.repository}` : null),
        }))
      ),
    }));
  }),

  // Create a new project
  createProject: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await dokployFetch<DokployProject>('project.create', {
        method: 'POST',
        body: JSON.stringify({ json: input }),
      });
      return result;
    }),

  // Create a preview deployment
  createPreviewDeployment: publicProcedure
    .input(
      z.object({
        applicationId: z.string(),
        branch: z.string(),
        commitHash: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await dokployFetch<DokployPreviewDeployment>('application.createPreview', {
        method: 'POST',
        body: JSON.stringify({ 
          json: {
            applicationId: input.applicationId,
            branch: input.branch,
            commitHash: input.commitHash,
          }
        }),
      });
      return result;
    }),

  // Get preview deployments for an application
  getPreviewDeployments: publicProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(async ({ input }) => {
      const deployments = await dokployFetch<DokployPreviewDeployment[]>(
        `application.previews?input=${encodeURIComponent(JSON.stringify({ json: { applicationId: input.applicationId } }))}`
      );
      return deployments;
    }),

  // Delete a preview deployment
  deletePreviewDeployment: publicProcedure
    .input(z.object({ deploymentId: z.string() }))
    .mutation(async ({ input }) => {
      await dokployFetch('application.deletePreview', {
        method: 'POST',
        body: JSON.stringify({ json: { deploymentId: input.deploymentId } }),
      });
      return { success: true };
    }),

  // Get deployment status
  getDeploymentStatus: publicProcedure
    .input(z.object({ deploymentId: z.string() }))
    .query(async ({ input }) => {
      const deployment = await dokployFetch<DokployPreviewDeployment>(
        `application.previewStatus?input=${encodeURIComponent(JSON.stringify({ json: { deploymentId: input.deploymentId } }))}`
      );
      return deployment;
    }),
});

