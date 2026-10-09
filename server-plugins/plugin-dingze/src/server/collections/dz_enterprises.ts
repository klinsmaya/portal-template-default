import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_enterprises',
  title: '企业',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'string', name: 'name', allowNull: false },
    { type: 'string', name: 'shortName', allowNull: false },
    { type: 'string', name: 'size', defaultValue: 'sme' },
    { type: 'string', name: 'status', defaultValue: 'active' },
    { type: 'hasMany', name: 'projects', target: 'dz_projects', foreignKey: 'enterpriseId' },
    { type: 'hasMany', name: 'orgUnits', target: 'dz_org_units', foreignKey: 'enterpriseId' },
    spaceField,
  ],
});
