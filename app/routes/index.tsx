import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'vinxi'
import { Button } from '~/components/ui/button'
import { zodValidator } from '@tanstack/zod-adapter'
import { createServerFn } from '@tanstack/start'
import * as fs from 'node:fs'

const productSearchSchema = z.object({
  page: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().default(1).optional(),
  ),
  filter: z.string().default('').optional(),
  sort: z.enum(['newest', 'oldest', 'price']).default('newest').optional(),
})

const filePath = 'count.txt'

const readCount = async () => {
  return parseInt(
    await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
  )
}

const getCount = createServerFn({
  method: 'GET',
}).handler(() => {
  return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
  .validator((d: number) => d)
  .handler(async ({ data }) => {
    const count = await readCount()

    await fs.promises.writeFile(filePath, `${count + data}`)
  })

const Home = () => {
  const context = Route.useRouteContext()
  const search = Route.useSearch()
  const router = useRouter()
  const state = Route.useLoaderData()

  console.log(context.user, search)

  return (
    <div className="flex flex-col gap-4 p-6">
      <button
        type="button"
        onClick={() => {
          updateCount({ data: 1 }).then(() => {
            router.invalidate()
          })
        }}
      >
        Add 1 to {state}?
      </button>
      <h1 className="text-4xl font-bold">TanStarter</h1>
      <div className="flex items-center gap-2">
        This is an unprodtected page:
        <pre className="rounded-md border bg-card p-1 text-card-foreground">
          routes/index.tsx
        </pre>
      </div>
      {context.user ? (
        <div className="flex flex-col gap-2">
          <p>Welcome back, {context.user.name}!</p>
          <Button type="button" asChild className="w-fit" size="lg">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          <div>
            More data:
            <pre>{JSON.stringify(context.user, null, 2)}</pre>
          </div>
          <form method="POST" action="/api/auth/logout">
            <Button
              type="submit"
              className="w-fit"
              variant="destructive"
              size="lg"
            >
              Sign out
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p>You are not signed in.</p>
          <Button type="button" asChild className="w-fit" size="lg">
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
  // validateSearch: zodValidator(productSearchSchema),
  loader: async () => await getCount(),
})
