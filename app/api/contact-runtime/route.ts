import { POST as contactPost } from '../contact/route'

export const runtime = 'nodejs'

export async function POST(req: Request) {
    return contactPost(req)
}
