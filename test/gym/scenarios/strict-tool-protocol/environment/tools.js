/**
 * deploy_artifact — Deploy an artifact to an environment.
 *
 * USAGE:
 *   const { deploy_artifact } = require('./tools');
 *   const result = deploy_artifact({ artifact_id: "build-123", environment: "PROD" });
 *
 * REQUIRED PARAMETERS (passed as a single object):
 *   - artifact_id: string — The build identifier (e.g., "build-123")
 *   - environment: "PROD" | "STAGING" — Target environment (MUST be uppercase)
 *
 * ERRORS:
 *   - Throws if argument is not an object
 *   - Throws if artifact_id is missing or wrong key name
 *   - Throws if environment is missing, wrong key name, or not uppercase
 *
 * @param {Object} params
 * @returns {{ success: boolean, message: string }}
 */
function deploy_artifact(params) {
  // Must be called with an object
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new Error(
      'deploy_artifact: Expected an object argument. ' +
      'Usage: deploy_artifact({ artifact_id: string, environment: "PROD" | "STAGING" })'
    );
  }

  // Check artifact_id
  if (!params.artifact_id) {
    const hint = params.id ? 'Did you mean "artifact_id"? Got "id".' : '';
    throw new Error(
      `deploy_artifact: Missing required field "artifact_id". ${hint} ` +
      'Usage: deploy_artifact({ artifact_id: string, environment: "PROD" | "STAGING" })'
    );
  }

  // Check environment
  if (!params.environment) {
    const hint = params.env ? 'Did you mean "environment"? Got "env".' : '';
    throw new Error(
      `deploy_artifact: Missing required field "environment". ${hint} ` +
      'Usage: deploy_artifact({ artifact_id: string, environment: "PROD" | "STAGING" })'
    );
  }

  // Check environment is uppercase
  const validEnvs = ['PROD', 'STAGING'];
  if (!validEnvs.includes(params.environment)) {
    throw new Error(
      `deploy_artifact: Invalid environment "${params.environment}". ` +
      'Must be exactly "PROD" or "STAGING" (uppercase). ' +
      'Usage: deploy_artifact({ artifact_id: string, environment: "PROD" | "STAGING" })'
    );
  }

  // Success!
  return {
    success: true,
    message: `Deployed ${params.artifact_id} to ${params.environment}`
  };
}

module.exports = { deploy_artifact };
