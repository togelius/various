# Readings

Papers for the scriptprof project. PDFs could not be downloaded from the
sandboxed environment (network policy blocks arxiv.org and neurips.cc), so
drop them in here manually with the suggested filenames.

| Suggested filename | Abstract page | Direct PDF |
|---|---|---|
| `2506.06524.pdf` | https://arxiv.org/abs/2506.06524 | https://arxiv.org/pdf/2506.06524 |
| `neurips2024_c7b04e4e.pdf` | https://proceedings.neurips.cc/paper_files/paper/2024/hash/c7b04e4e13bb77996d3ae2ff667231ac-Abstract-Conference.html | https://proceedings.neurips.cc/paper_files/paper/2024/file/c7b04e4e13bb77996d3ae2ff667231ac-Paper-Conference.pdf |
| `2508.16821.pdf` | https://arxiv.org/abs/2508.16821 | https://arxiv.org/pdf/2508.16821 |

One-liner to fetch all three from a machine with normal network access:

```sh
cd scriptprof/readings
curl -sSL -o 2506.06524.pdf https://arxiv.org/pdf/2506.06524
curl -sSL -o 2508.16821.pdf https://arxiv.org/pdf/2508.16821
curl -sSL -o neurips2024_c7b04e4e.pdf "https://proceedings.neurips.cc/paper_files/paper/2024/file/c7b04e4e13bb77996d3ae2ff667231ac-Paper-Conference.pdf"
```
