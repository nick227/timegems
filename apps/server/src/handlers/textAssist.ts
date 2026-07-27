import { TextAssistService } from '../services/TextAssistService'

const textAssistService = new TextAssistService()

export async function createTextAssist(request: any, reply: any) {
  const { text, mode } = request.body
  const result = await textAssistService.run(text, mode)
  return reply.send({ data: { result } })
}
