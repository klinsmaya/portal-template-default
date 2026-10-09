import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_org_units',
  title: '组织部门',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'string', name: 'name', allowNull: false },
    { type: 'string', name: 'kind', defaultValue: 'department' },
    { type: 'belongsTo', name: 'head', target: 'users', foreignKey: 'headId' },
    { type: 'integer', name: 'sort', defaultValue: 0 },
    spaceField,
  ],
});
