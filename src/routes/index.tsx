import { createFileRoute } from '@tanstack/react-router'

import { FamilyPage } from '#/components/family/FamilyPage'

export const Route = createFileRoute('/')({ component: FamilyPage })
