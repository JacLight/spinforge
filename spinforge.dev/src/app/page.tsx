import Image from "next/image";
import { Button } from "@/components/ui/button";
import CheckIcon from "@/components/CheckIcon";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  The Ultimate Developer Platform
                </h1>
                <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                  SpinForge is a next-generation platform for developers to build, deploy, and scale their applications with ease.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button>Get Started</Button>
                <Button variant="outline">Learn More</Button>
              </div>
            </div>
            <Image
              alt="Hero"
              className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
              height="550"
              src="https://picsum.photos/seed/spinforge-hero/550/550"
              width="550"
            />
          </div>
        </div>
      </section>
      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">Key Features</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Faster. More powerful. More flexible.</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                SpinForge provides everything you need to build and scale your applications, from a powerful CLI to a beautiful dashboard.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center space-y-4">
              <ul className="grid gap-6">
                <li>
                  <div className="grid gap-1">
                    <h3 className="text-xl font-bold">Spinlets</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Deploy your applications as Spinlets, lightweight and isolated environments.
                    </p>
                  </div>
                </li>
                <li>
                  <div className="grid gap-1">
                    <h3 className="text-xl font-bold">CLI</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      A powerful CLI to manage your applications and infrastructure.
                    </p>
                  </div>
                </li>
                <li>
                  <div className="grid gap-1">
                    <h3 className="text-xl font-bold">Dashboard</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      A beautiful and intuitive dashboard to monitor your applications.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <Image
              alt="Features"
              className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full lg:order-last"
              height="310"
              src="https://picsum.photos/seed/spinforge-features/550/310"
              width="550"
            />
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">How it Works</h2>
            <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              SpinForge is designed to be simple and intuitive. Here's a quick overview of how it works.
            </p>
          </div>
          <div className="mx-auto w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center space-y-2">
              <div
                className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold dark:bg-gray-800">1</div>
              <h3 className="text-xl font-bold">Connect Your Git Repository</h3>
              <p className="text-gray-500 dark:text-gray-400">Link your GitHub, GitLab, or Bitbucket account to SpinForge.</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold dark:bg-gray-800">2</div>
              <h3 className="text-xl font-bold">Configure Your Project</h3>
              <p className="text-gray-500 dark:text-gray-400">SpinForge automatically detects your framework and sets up the optimal build configuration.</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div
                className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold dark:bg-gray-800">3</div>
              <h3 className="text-xl font-bold">Deploy and Scale</h3>
              <p className="text-gray-500 dark:text-gray-400">Your application is deployed globally and can be scaled with a single command.</p>
            </div>
          </div>
        </div>
      </section>
      <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">Pricing</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Flexible pricing for teams of all sizes</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Choose the plan that&apos;s right for you. All plans include a 14-day free trial.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 lg:grid-cols-3 lg:gap-12">
            <div className="grid gap-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-2xl font-bold">Hobby</h3>
              <p className="text-4xl font-bold">$10<span className="text-lg font-normal">/mo</span></p>
              <p className="text-gray-500 dark:text-gray-400">For personal projects and experiments.</p>
              <ul className="grid gap-2 text-sm">
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />1 user</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />1 project</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />1GB storage</li>
              </ul>
              <Button>Get Started</Button>
            </div>
            <div className="grid gap-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-2xl font-bold">Pro</h3>
              <p className="text-4xl font-bold">$50<span className="text-lg font-normal">/mo</span></p>
              <p className="text-gray-500 dark:text-gray-400">For small teams and growing businesses.</p>
              <ul className="grid gap-2 text-sm">
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />5 users</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />5 projects</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />10GB storage</li>
              </ul>
              <Button>Get Started</Button>
            </div>
            <div className="grid gap-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
              <h3 className="text-2xl font-bold">Enterprise</h3>
              <p className="text-4xl font-bold">Custom</p>
              <p className="text-gray-500 dark:text-gray-400">For large teams and mission-critical applications.</p>
              <ul className="grid gap-2 text-sm">
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />Unlimited users</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />Unlimited projects</li>
                <li><CheckIcon className="mr-2 inline-block h-4 w-4" />Custom storage</li>
              </ul>
              <Button>Contact Us</Button>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32 border-t">
        <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">Get Started with SpinForge</h2>
            <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Sign up for a free account and start building your next application in minutes.
            </p>
          </div>
          <div className="mt-6">
            <Button>Sign Up for Free</Button>
          </div>
        </div>
      </section>
    </main>
  );
}