const GH = "https://github.com";

export function repoUrl(full: string): string { return `${GH}/${full}`; }
export function prUrl(full: string, n: number): string { return `${GH}/${full}/pull/${n}`; }
export function issueUrl(full: string, n: number): string { return `${GH}/${full}/issues/${n}`; }
export function advisoryUrl(ghsa: string): string { return `${GH}/advisories/${ghsa}`; }

export function packageUrl(ecosystem: string, name: string): string {
  switch (ecosystem.toLowerCase()) {
    case "npm": return `https://www.npmjs.com/package/${name}`;
    case "pip": case "pypi": return `https://pypi.org/project/${name}/`;
    case "rubygems": return `https://rubygems.org/gems/${name}`;
    case "cargo": return `https://crates.io/crates/${name}`;
    case "maven": return `https://central.sonatype.com/search?q=${encodeURIComponent(name)}`;
    case "nuget": return `https://www.nuget.org/packages/${name}`;
    case "composer": return `https://packagist.org/packages/${name}`;
    case "go": return `https://pkg.go.dev/${name}`;
    default: return `${GH}/search?q=${encodeURIComponent(name)}&type=registrypackages`;
  }
}
