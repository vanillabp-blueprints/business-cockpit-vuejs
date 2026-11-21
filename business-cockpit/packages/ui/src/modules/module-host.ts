import { createModuleHost, type ModuleHost } from '@example/bc-module-host';
import { OfficialWorkflowModulesApi } from '../generated/official-gui-api/sdk.gen';

const workflowModules = new OfficialWorkflowModulesApi();

/**
 * The one loader of the user interface. Every part of a workflow module comes through it, and no other
 * code loads a module. The registry reads GET /workflow-module once, and GET
 * /workflow-module/{id} for a module that registered after the page loaded.
 */
export const moduleHost: ModuleHost = createModuleHost({
  loadModules: async () => (await workflowModules.getWorkflowModules()).modules,
  loadModule: async (workflowModuleId) => {
    try {
      return await workflowModules.getWorkflowModule({ workflowModuleId });
    } catch {
      // A module the user may not see, or one that is gone: it has no parts here.
      return undefined;
    }
  },
});

/** Reads the registry at the start. A failure is not shown here: the loader asks again when a part needs it. */
export function startModuleRegistry(): void {
  moduleHost.registry.load().catch(() => undefined);
}
