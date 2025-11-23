import { useParams, useSearchParams } from 'react-router-dom'
import LearnMode from '../components/study-modes/LearnMode'
import MultipleChoiceQuiz from '../components/study-modes/MultipleChoiceQuiz'
import MatchingGame from '../components/study-modes/MatchingGame'
import WritingPractice from '../components/study-modes/WritingPractice'
import FillTheGaps from '../components/study-modes/FillTheGaps'
import TestFlow from '../components/study-modes/TestFlow'

const StudyMode = () => {
  const { planId, mode } = useParams()
  const [searchParams] = useSearchParams()
  
  // Route to appropriate study mode component
  switch (mode) {
    case 'learn':
      return <LearnMode />
    case 'quiz':
      return <MultipleChoiceQuiz />
    case 'match':
      return <MatchingGame />
    case 'write':
      return <WritingPractice />
    case 'fill_gaps':
      return <FillTheGaps />
    case 'short_test':
    case 'long_test':
      return <TestFlow />
    default:
      return <div className="p-4"><div className="card">Unknown study mode: {mode}</div></div>
  }
}

export default StudyMode
