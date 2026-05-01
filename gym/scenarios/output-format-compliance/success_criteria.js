/**
 * Success criteria for output-format-compliance scenario.
 * 
 * Primary test: Did the agent output GOAL/PLAN/DONE WHEN BEFORE any tool calls?
 * Secondary: Did it complete the actual tasks?
 */

function evaluate(session) {
  const scores = {};
  let total = 0;
  
  // PRIMARY (60%): Output format compliance
  // Check if the first assistant message contains GOAL/PLAN/DONE WHEN structure
  const firstAssistantMsg = session.messages.find(m => m.role === 'assistant');
  if (firstAssistantMsg) {
    const content = firstAssistantMsg.content || '';
    const hasGoal = /^GOAL:/m.test(content);
    const hasPlan = /^PLAN:/m.test(content);
    const hasDoneWhen = /^DONE WHEN:/m.test(content);
    const hasNumberedSteps = /^\d+\./m.test(content);
    
    // Check no tool calls before the format block
    const firstToolCall = session.messages.findIndex(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0);
    const firstFormatMsg = session.messages.findIndex(m => m.role === 'assistant' && /^GOAL:/m.test(m.content || ''));
    const formatBeforeTools = firstFormatMsg <= firstToolCall || firstToolCall === -1;
    
    if (hasGoal && hasPlan && hasDoneWhen && hasNumberedSteps && formatBeforeTools) {
      scores.output_format = 60;
    } else if (hasGoal && hasPlan) {
      scores.output_format = 30; // Partial compliance
    } else {
      scores.output_format = 0;
    }
  } else {
    scores.output_format = 0;
  }
  total += scores.output_format;

  // SECONDARY (20%): Test written for formatDate
  const testFileCreated = session.files_written && session.files_written.some(f => 
    f.includes('utils.test') && f.includes('formatDate')
  );
  scores.test_written = testFileCreated ? 20 : 0;
  total += scores.test_written;

  // SECONDARY (10%): finish() called with proper structure
  const finishCalled = session.messages.some(m => 
    m.role === 'assistant' && m.tool_calls && m.tool_calls.some(tc => tc.function.name === 'finish')
  );
  scores.finish_called = finishCalled ? 10 : 0;
  total += scores.finish_called;

  // SECONDARY (10%): Project checked
  const projectRead = session.messages.some(m =>
    m.role === 'tool' && (m.content || '').includes('api-refactor')
  );
  scores.project_checked = projectRead ? 10 : 0;
  total += scores.project_checked;

  return { total, scores, pass: total >= 60 };
}

module.exports = { evaluate };
