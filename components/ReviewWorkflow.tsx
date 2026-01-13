'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, CheckCircle, XCircle, Eye } from 'lucide-react';

interface ReviewWorkflowProps {
  taskId: string;
  status: string;
  previewUrl?: string | null;
  branchName?: string | null;
  onStatusChange?: () => void;
}

export function ReviewWorkflow({ taskId, status, previewUrl, branchName, onStatusChange }: ReviewWorkflowProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const approveMutation = trpc.tasks.approve.useMutation({
    onSuccess: () => {
      onStatusChange?.();
    },
  });

  const rejectMutation = trpc.tasks.reject.useMutation({
    onSuccess: () => {
      setIsRejectDialogOpen(false);
      setRejectReason('');
      onStatusChange?.();
    },
  });

  const handleApprove = () => {
    approveMutation.mutate({ id: taskId });
  };

  const handleReject = () => {
    rejectMutation.mutate({ 
      id: taskId, 
      reason: rejectReason || undefined 
    });
  };

  if (status !== 'review') {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Ready for Review</CardTitle>
            <CardDescription>
              This task has been completed and is ready for review
              {branchName && (
                <span className="block mt-1">
                  Branch: <Badge variant="outline">{branchName}</Badge>
                </span>
              )}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            Review
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Preview
              <ExternalLink className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Preview deployment is ready
            </span>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            {approveMutation.isPending ? 'Approving...' : 'Approve & Deploy'}
          </Button>
          
          <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Task</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejecting this task. This will help improve future implementations.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  placeholder="Reason for rejection (optional)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsRejectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}