import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const workDir = process.env.BLOG_BUILD_WORK_DIR || 'data'
const blogFile = process.env.BLOG_BUILD_FILE || 'index.md'

console.info(`Working on directory: ${workDir}`)
console.info(`Working on blog file: ${blogFile}`)

export interface Problem {
    validAsPids: string[]
    tags: string[]
    date: string
    statement: string
    solution: string
    code: string
}

const problems: Record<string, Problem> = {}

class ProblemModel {
    static add(problem: Problem) {
        for (const pid of problem.validAsPids) {
            problems[pid] = problem
        }
    }

    static exists(pid: string): boolean {
        if (problems[pid]) return true
        else return false
    }

    static get(pid: string): Problem {
        return problems[pid]
    }
}

function loadProblems(dir: string) {
    console.info(`Loading directory: ${dir}`)
    const names = readdirSync(dir)
    for (const name of names) {
        if (!name.endsWith('.cpp')) continue
        const pid = name.replace(/\.cpp$/, '')
        console.info(`Adding problem: ${pid}`)
        let code = readFileSync(path.resolve(dir, name)).toString()
        code = code.replace(/\r/g, '').trim().split('\n')
            .map((line) => `@${line}`.trim().replace(/^@/, '')).join('\n').trim()
        if (!/^\/\*\*(\n \* @[a-z]+?: .+?)+?\n \*\//.test(code)) {
            console.info(`Skipped code file ${name}`)
            continue
        }
        const result = /^\/\*\*((\n \* @[a-z]+?: .+?)+?)\n \*\//.exec(code) as RegExpExecArray
        const data = Object.fromEntries(result[1].split('\n').filter((line) => line)
            .map((line) => [line.split(' * @')[1].split(':')[0], line.split(': ')[1]]))
        if (!data.problem.split(', ').includes(pid))
            throw new Error(`Pids error in file ${path.resolve(dir, name)}`)
        const solutionPath = path.resolve(dir, `${pid}.md`)
        ProblemModel.add({
            validAsPids: data.problem.split(', '),
            tags: data.tags ? data.tags.split(', ') : [],
            date: data.date,
            statement: '',
            solution: existsSync(solutionPath) ? readFileSync(solutionPath).toString().trim() : '待补充。',
            code: code.replace(/^\/\*\*((\n \* @[a-z]+?: .+?)+?)\n \*\//, '').trim(),
        })
    }
    for (const name of names) {
        if (!name.startsWith('.') && statSync(path.resolve(dir, name)).isDirectory()) {
            loadProblems(path.resolve(dir, name))
        }
    }
}

function convert(file: string): string {
    return file.replace(/<!-- problem\..+?\.begin -->(\n.*)+?\n<!-- problem\..+?\.end -->/g, (part) => {
        const pid = part.split('.')[1]
        console.log(pid)
        if (!ProblemModel.exists(pid)) return part
        const problem = ProblemModel.get(pid)
        return part.replace(/<!-- problem\..+?\.end -->$/, (end) => {
            return [
                `### 解答\n\n${problem.solution}`,
                `### 代码\n\n\`\`\`cpp\n${problem.code}\n\`\`\``,
                end,
            ].join('\n\n')
        })
    })
}

loadProblems(workDir)
writeFileSync('result.md', convert(readFileSync(blogFile).toString().replace(/\r/g, '').trim()))
