export interface Monitor{
    id:number;
    name:string;
    url:string;
    interval:number;
    status:"up"|"down"|"pending";
    monitor_type:"free"|"premium";
    telegram_chat_id:string;
    created_at:Date;
    updated_at:Date;

}

export interface CreateMonitorDTO {
  name: string;
  url: string;
 
}