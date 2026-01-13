# Review Workflow with Dokploy Preview Deployments

This document explains the review workflow implementation that leverages Dokploy's preview deployments for task review before merging to main and deploying to production.

## Overview

The review workflow adds a "review" stage between task completion and production deployment. When tasks are completed by the agent runner, they are automatically submitted for review with a preview deployment, allowing stakeholders to test changes before they go live.

## Workflow Stages

### 1. Task Execution
- Agent runner picks up pending tasks
- Executes the task using OpenCode CLI
- Commits changes to a feature branch
- Pushes the branch to the remote repository

### 2. Preview Deployment Creation
- Creates a Dokploy preview deployment for the feature branch
- Updates task status to "review"
- Stores preview URL and deployment ID in the database

### 3. Review Process
- Tasks appear in the Review Dashboard
- Reviewers can view the preview deployment
- Reviewers can approve or reject the task

### 4. Approval/Rejection
- **Approved**: Merges to main, deploys to production, cleans up preview
- **Rejected**: Cleans up preview deployment and feature branch

## Database Schema Changes

Added new fields to the `agent_tasks` table:
- `status`: Added "review" enum value
- `preview_url`: URL of the preview deployment
- `preview_deployment_id`: Dokploy deployment ID for cleanup

## New Components

### ReviewWorkflow Component
- Displays review controls for tasks in review status
- Shows preview deployment link
- Provides approve/reject buttons
- Located: `components/ReviewWorkflow.tsx`

### ReviewDashboard Component
- Lists all tasks awaiting review
- Shows task details and preview links
- Integrates with ReviewWorkflow component
- Located: `components/ReviewDashboard.tsx`

## API Endpoints

### Dokploy Router Extensions
- `createPreviewDeployment`: Creates a new preview deployment
- `getPreviewDeployments`: Lists preview deployments for an application
- `deletePreviewDeployment`: Removes a preview deployment
- `getDeploymentStatus`: Checks deployment status

### Tasks Router Extensions
- `submitForReview`: Submits a completed task for review
- `approve`: Approves a task (triggers merge and production deployment)
- `reject`: Rejects a task (cleans up preview deployment)
- `getReviewTasks`: Gets all tasks in review status

## Scripts

### Agent Runner (`scripts/agent-runner.ts`)
Updated to:
- Create preview deployments instead of direct production deployments
- Set task status to "review" after successful completion
- Store preview deployment information

### Review Workflow Handler (`scripts/review-workflow.ts`)
New script that handles:
- Merging approved tasks to main branch
- Deploying approved tasks to production
- Cleaning up preview deployments
- Deleting feature branches

## Usage

### Starting the System
1. Start the agent runner: `npx tsx scripts/agent-runner.ts`
2. The web interface will show tasks and review queue

### Review Process
1. Navigate to the "Review Queue" tab
2. View tasks awaiting review
3. Click "View Preview" to test the changes
4. Click "Approve & Deploy" to merge and deploy
5. Click "Reject" to decline the changes

### Environment Variables
Required for Dokploy integration:
- `DOKPLOY_API_KEY`: API key for Dokploy
- `DOKPLOY_URL`: Dokploy instance URL (default: http://localhost:3000)

### Project Configuration
Update `PROJECT_APP_IDS` in both scripts to map your project paths to Dokploy application IDs:
```typescript
const PROJECT_APP_IDS: Record<string, string> = {
  '/home/zzula/projects/idea-factory-manager': 'your-app-id-here',
  // Add more projects as needed
};
```

## Benefits

1. **Quality Control**: All changes are reviewed before production
2. **Testing**: Preview deployments allow testing in a production-like environment
3. **Rollback Safety**: Failed deployments don't affect production
4. **Audit Trail**: Complete history of approvals and rejections
5. **Automated Cleanup**: Preview deployments are automatically cleaned up

## Future Enhancements

- Webhook integration for automatic deployment status updates
- Multiple reviewer requirements
- Integration with GitHub/GitLab for pull request creation
- Automated testing in preview environments
- Slack/Discord notifications for review requests

## Troubleshooting

### Preview Deployment Fails
- Check Dokploy API key and URL configuration
- Verify application ID mapping
- Check Dokploy logs for deployment errors

### Review Tasks Not Appearing
- Ensure database migration has been applied: `npm run db:push`
- Check that agent runner is creating preview deployments
- Verify task status is being set to "review"

### Merge Conflicts
- The review workflow handler will fail if there are merge conflicts
- Manually resolve conflicts and re-run the approval process
- Consider implementing automatic conflict resolution strategies