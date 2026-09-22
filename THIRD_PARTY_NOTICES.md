# Third-party notices

The original application code and documentation in this repository are licensed under the [MIT License](LICENSE), copyright © 2026 Kha Nguyen. Third-party software, fonts and test assets retain their own licenses. The root MIT license does not replace those terms.

## bpmn-js / bpmn.io

The editor uses **bpmn-js 18.22.1**, copyright © 2014–present Camunda Services GmbH, under the [bpmn.io license for v18.22.1](https://github.com/bpmn-io/bpmn-js/blob/v18.22.1/LICENSE).

This license includes an additional condition concerning the bpmn.io watermark. Preserve its rendering code and keep the watermark visible, unchanged and unobstructed in the application. The license is referred to as `LicenseRef-bpmn-io` in this repository; it is **not plain MIT**. Preserve the applicable upstream copyright and license notices when redistributing the software.

Related packages, including bpmn-moddle and transitive diagram libraries, retain the terms shipped in their respective package distributions. Check the version recorded in [pnpm-lock.yaml](pnpm-lock.yaml) and the package's license file when preparing a distribution.

## External BPMN test fixtures

[tests/fixtures/external/THIRD_PARTY_NOTICES.md](tests/fixtures/external/THIRD_PARTY_NOTICES.md) is the detailed fixture notice. Adjacent `.provenance.json` files record each source URL, pinned commit, checksum, license and bounded interoperability claim.

| Asset source | Applicable license / attribution |
| --- | --- |
| bpmn-js fixture collection, commit `319cb1ea74364c957a6c53e2ff70c27f8cc86462` | [bpmn.io license at the source commit](https://github.com/bpmn-io/bpmn-js/blob/319cb1ea74364c957a6c53e2ff70c27f8cc86462/LICENSE); Camunda Services GmbH |
| Camunda Modeler collaboration fixture, commit `9614b85d3073ea0f91233d473ed24c91ac2d4db1` | [MIT license at the source commit](https://github.com/camunda/camunda-modeler/blob/9614b85d3073ea0f91233d473ed24c91ac2d4db1/LICENSE); retain the source copyright notice |
| BPMN MIWG reference and SAP Signavio test models, commit `cb2629519cee6280ab521f99dc46a9815a221a35` | [BPMN MIWG Test Suite](https://github.com/bpmn-miwg/bpmn-miwg-test-suite), with attribution under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) as recorded in the fixture manifests |

The MIWG assets are `Reference/C.5.0.bpmn` and `SAP Signavio Process Manager 19.9.0/C.1.0-export.bpmn`, stored locally as `miwg-reference-call-activity-local.bpmn` and `miwg-signavio-message-catch.bpmn`. These files are preserved byte-for-byte. Source authorship and producer metadata remain recorded in the original XML and provenance manifests. Tests and preservation assertions added by this project are separate from the original files.

A fixture filename beginning with `camunda-modeler-` does not by itself establish MIT licensing: the message-catch and timer-boundary fixtures were sourced from bpmn-js and retain its bpmn.io license. Consult each manifest.

These test assets do not imply endorsement by Camunda, SAP Signavio, BPMN MIWG or OMG, and do not establish universal interoperability or certification.

## Other packages and hosted fonts

The project uses third-party packages listed in [package.json](package.json), with resolved versions in [pnpm-lock.yaml](pnpm-lock.yaml). Each package and its dependencies keep their distributed license and attribution files; this document is not an exhaustive replacement for them.

The interface requests **Be Vietnam Pro**, **JetBrains Mono** and **Space Grotesk** through Google Fonts. No standalone font binary is included by this application source. If you vendor or redistribute font files, retain the license and copyright notices from those font distributions.

When redistributing a built application or adding a new dependency or fixture, include its applicable license notices and update this file if there are additional attribution requirements.

## License texts retained in this repository

- [bpmn-js copyright and license](tests/fixtures/external/licenses/bpmn-js.txt), pinned to the fixture source commit.
- [Camunda Modeler MIT copyright and permission](tests/fixtures/external/licenses/camunda-modeler.txt), pinned to the fixture source commit.
- [bpmn-moddle MIT copyright and permission](tests/fixtures/external/licenses/bpmn-moddle.txt), version 10.1.0, including its copied schema bundle under `tests/fixtures/bpmn-xsd`.
- MIWG fixtures remain byte-original and attributed in the [fixture notices](tests/fixtures/external/THIRD_PARTY_NOTICES.md), which link the CC BY 3.0 license and original submissions.
