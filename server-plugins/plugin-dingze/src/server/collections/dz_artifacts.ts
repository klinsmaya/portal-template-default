import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_artifacts',
  title: '成果',
  createdBy: true,
  updatedBy: true,
  indexes: [{ unique: true, fields: ['projectId', 'code'] }],
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'string', name: 'status', defaultValue: 'not_started' },
    { type: 'boolean', name: 'stale', defaultValue: false },
    { type: 'text', name: 'staleReason' },
    { type: 'boolean', name: 'exception', defaultValue: false },
    { type: 'integer', name: 'currentRev', defaultValue: 0 },
    { type: 'belongsTo', name: 'currentVersion', target: 'dz_artifact_versions', foreignKey: 'currentVersionId', constraints: false },
    { type: 'belongsTo', name: 'stepDoneVersion', target: 'dz_artifact_versions', foreignKey: 'stepDoneVersionId', constraints: false },
    { type: 'belongsTo', name: 'lockedVersion', target: 'dz_artifact_versions', foreignKey: 'lockedVersionId', constraints: false },
    { type: 'hasMany', name: 'versions', target: 'dz_artifact_versions', foreignKey: 'artifactId' },
    spaceField,
  ],
});
