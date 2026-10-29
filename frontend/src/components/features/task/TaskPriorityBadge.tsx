export const TaskPriorityBadge = ({ priority }: { priority: number }) => (
  <span className="text-xs font-medium text-foreground" title={`Ưu tiên ${priority}/5`}>
    P{priority}
  </span>
);

export default TaskPriorityBadge;
