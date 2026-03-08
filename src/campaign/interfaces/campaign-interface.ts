export interface ICampaign {
  name: string;
  campaignType?: string;
  messageContent?: string;
  isGroup?: boolean;
  user?: any;
  contacts?: any[];
  filterChannels?: boolean;
  disableClaims?: boolean;
  timeZoneScheduling?: boolean;
  queued?: number;
  sent?: number;
  delivered?: number;
  undelivered?: number;
  response?: number;
  failed?: number;
  stop?: number;
  spam?: number;
  status?: string;
  processedRecipients?: number;
}
