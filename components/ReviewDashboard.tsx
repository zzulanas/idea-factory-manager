'use client';

import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReviewWorkflow } from './ReviewWorkflow';
import { ExternalLink, Clock, GitBranch } from 'lucide-react';

export function ReviewDashboard() {
  const { data: reviewTasks, refetch } = trpc.tasks.getReviewTasks.useQuery();

  if (!reviewTasks?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
          <CardDescription>No tasks currently awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Tasks that are completed and ready for review will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review Dashboard</h2>
        <p className="text-gray-600">
          {reviewTasks.length} task{reviewTasks.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      <div className="space-y-4">
        {reviewTasks.map((task) => (
          <Card key={task.id} className="border-l-4 border-l-orange-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <CardDescription className="max-w-2xl">
                    {task.prompt}
                  </CardDescription>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(task.updatedAt).toLocaleString()}
                    </div>
                    
                    {task.branchName && (
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-4 w-4" />
                        {task.branchName}
                      </div>
                    )}
                    
                    {task.previewUrl && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => window.open(task.previewUrl!, '_blank')}
                        className="p-0 h-auto flex items-center gap-1"
                      >
                        Preview <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Review
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <ReviewWorkflow
                taskId={task.id}
                status={task.status}
                previewUrl={task.previewUrl}
                branchName={task.branchName}
                onStatusChange={() => refetch()}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}