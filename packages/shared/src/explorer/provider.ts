export type DataEntityRow = {
  name: string;
  id: string;
};

export type DataEntitySearchDef = {
  kind: "tfl-bus-stops";
  placeholder: string;
  buttonLabel: string;
};

export type DataEntityDef = {
  id: string;
  label: string;
  description: string;
  rows?: DataEntityRow[];
  search?: DataEntitySearchDef;
};

export type WorkbenchSectionDef = {
  id: string;
  label: string;
  description: string;
  endpointIds: string[];
};

export type ProviderWorkbenchDef = {
  id: string;
  label: string;
  settingsLabel: string;
  settingsDescription: string;
  referenceLabel: string;
  referenceDescription: string;
  sections: WorkbenchSectionDef[];
  referenceEntities: DataEntityDef[];
};
