export interface BpmnTypographyPort {
  prepare(): Promise<void>;
  config(): {
    defaultStyle: { fontFamily: string };
    externalStyle: { fontFamily: string };
  };
}
