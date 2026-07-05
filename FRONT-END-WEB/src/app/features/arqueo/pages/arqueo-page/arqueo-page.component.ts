import { Component, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { combineLatest, debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap, tap } from 'rxjs';
import { NotificationService } from '@core/services/notification.service';
import { ApiResponse } from '@shared/models/api-response.model';
import { ArqueoDaily, ArqueoDetailItem, ArqueoSummaryItem } from '@shared/models/arqueo.model';
import { environment } from 'src/environments/environment';
import { ArqueoService } from '../../services/arqueo.service';

@Component({selector:'app-arqueo-page',templateUrl:'./arqueo-page.component.html',styleUrls:['./arqueo-page.component.scss'],providers:[ArqueoService]})
export class ArqueoPageComponent{
	private readonly svc=inject(ArqueoService);
	private readonly notification=inject(NotificationService);
	readonly branding=environment.branding;
	private readonly reportLogoUrl='assets/logo-semapam-impresion.png';
	currentArqueo:ArqueoDaily|null=null;
	hasDetailData=false;
	loading=false;
	detailPageIndex=0;
	detailPageSize=10;
	readonly detailPageSizeOptions=[10,20,50,100];
	pagedDetails:ArqueoDetailItem[]=[];
	startDateControl=new FormControl(new Date());
	endDateControl=new FormControl(new Date());
	arqueo$=combineLatest([
		this.startDateControl.valueChanges.pipe(startWith(this.startDateControl.value)),
		this.endDateControl.valueChanges.pipe(startWith(this.endDateControl.value))
	]).pipe(
		debounceTime(160),
		map(([startDate,endDate])=>this.buildDateRangeQuery(startDate,endDate)),
		distinctUntilChanged((prev,current)=>prev.start===current.start&&prev.end===current.end),
		tap(()=>{this.loading=true;}),
		switchMap((query)=>this.svc.daily(query).pipe(finalize(()=>{this.loading=false;}))),
		tap((response:ApiResponse<ArqueoDaily>)=>{
			this.currentArqueo=response.data;
			this.hasDetailData=!!response.data?.details?.length;
			this.detailPageIndex=0;
			this.updatePagedDetails(response.data?.details||[]);
		})
	);

	exportArqueoAsCsv():void{
		const arqueo=this.requireCurrentArqueo('exportar');
		if(!arqueo){
			return;
		}

		const csv=[this.getDetailHeader(),...this.getDetailRows(arqueo)]
			.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(','))
			.join('\r\n');

		this.downloadBlob(csv,`arqueo-${this.getFilePeriodLabel(arqueo)}.csv`,'text/csv;charset=utf-8;');
		this.notification.success('CSV exportado correctamente.');
	}

	async exportArqueoAsXlsx():Promise<void>{
		const arqueo=this.requireCurrentArqueo('exportar');
		if(!arqueo){
			return;
		}

		try{
			const workbook=new ExcelJS.Workbook();
			workbook.creator=this.branding.organizationName;
			workbook.created=new Date();
			const sheet=workbook.addWorksheet('Arqueo diario',{views:[{state:'frozen',ySplit:8}]});
			sheet.properties.defaultRowHeight=22;
			sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2}};

			const logoDataUrl=await this.getAssetDataUrl(this.reportLogoUrl);
			if(logoDataUrl){
				const imageId=workbook.addImage({base64:logoDataUrl,extension:'png'});
				sheet.addImage(imageId,{tl:{col:0.35,row:0.25},ext:{width:180,height:72}});
			}

			sheet.mergeCells('C1:H1');
			sheet.getCell('C1').value='Arqueo diario';
			sheet.getCell('C1').font={name:'Calibri',size:22,bold:true,color:{argb:'FF163F63'}};
			sheet.getCell('C1').alignment={vertical:'middle',horizontal:'left'};

			sheet.mergeCells('C2:H2');
			sheet.getCell('C2').value=`${this.branding.organizationName} · Reporte consolidado operativo`;
			sheet.getCell('C2').font={name:'Calibri',size:11,color:{argb:'FF5E768B'}};

			sheet.mergeCells('I1:J1');
			sheet.getCell('I1').value='Periodo consultado';
			sheet.getCell('I1').font={size:10,bold:true,color:{argb:'FF6C7D8A'}};
			sheet.getCell('I1').alignment={horizontal:'right'};

			sheet.mergeCells('I2:J2');
			sheet.getCell('I2').value=this.getPeriodLabel(arqueo);
			sheet.getCell('I2').font={size:12,bold:true,color:{argb:'FF163F63'}};
			sheet.getCell('I2').alignment={horizontal:'right'};

			[
				{range:'A4:B5',label:'Tickets',value:arqueo.total_tickets,currency:false},
				{range:'C4:D5',label:'Abastecimientos',value:arqueo.total_abastecimientos,currency:false},
				{range:'E4:F5',label:'Monto total',value:arqueo.total_monto,currency:true},
				{range:'G4:H5',label:'Registros detalle',value:arqueo.details.length,currency:false}
			].forEach(card=>this.paintMetricCard(sheet,card.range,card.label,card.value,card.currency));

			let currentRow=8;
			currentRow=this.renderSummarySection(sheet,currentRow,'Resumen por zona','Agrupacion consolidada a partir del detalle diario.',arqueo.zone_summary,'FF1E7A8A','Zona');
			currentRow+=1;
			currentRow=this.renderSummarySection(sheet,currentRow,'Resumen por producto','Cantidad despachada y monto por producto.',arqueo.product_summary,'FF2C8A56','Producto');
			currentRow+=1;
			this.renderDetailSection(sheet,currentRow,arqueo);

			sheet.columns=[{width:18},{width:13},{width:20},{width:24},{width:12},{width:14},{width:16},{width:14},{width:14},{width:14}];

			const buffer=await workbook.xlsx.writeBuffer();
			this.downloadBlob(buffer,`arqueo-${this.getFilePeriodLabel(arqueo)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
			this.notification.success('Excel exportado correctamente.');
		}catch{
			this.notification.error('No se pudo generar el Excel del arqueo.');
		}
	}

	async exportArqueoAsPdf():Promise<void>{
		const arqueo=this.requireCurrentArqueo('exportar');
		if(!arqueo){
			return;
		}

		try{
			const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
			const logoDataUrl=await this.getAssetDataUrl(this.reportLogoUrl);
			const pageWidth=pdf.internal.pageSize.getWidth();
			let cursorY=54;

			pdf.setFillColor(12,59,90);
			pdf.roundedRect(32,28,pageWidth-64,88,18,18,'F');
			if(logoDataUrl){
				pdf.addImage(logoDataUrl,'PNG',48,42,96,60,undefined,'FAST');
			}
			pdf.setTextColor(255,255,255);
			pdf.setFont('helvetica','bold');
			pdf.setFontSize(22);
			pdf.text('Arqueo diario',160,62);
			pdf.setFontSize(11);
			pdf.setFont('helvetica','normal');
			pdf.text(this.branding.organizationName,160,82);
			pdf.text(`Periodo consultado: ${this.getPeriodLabel(arqueo)}`,160,98);
			pdf.setTextColor(25,38,56);
			cursorY=138;

			autoTable(pdf,{startY:cursorY,head:[['Indicador','Valor','Indicador','Valor']],body:[['Tickets',String(arqueo.total_tickets),'Abastecimientos',String(arqueo.total_abastecimientos)],['Monto total',this.formatAmount(arqueo.total_monto),'Registros detalle',String(arqueo.details.length)]],theme:'grid',headStyles:{fillColor:[22,84,128]},styles:{fontSize:10,cellPadding:8}});

			cursorY=(pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
			pdf.setFont('helvetica','bold');
			pdf.setFontSize(13);
			pdf.text('Resumen por zona',40,cursorY+24);
			autoTable(pdf,{startY:cursorY+34,head:[['Zona','Tickets','Cantidad total','Monto total']],body:arqueo.zone_summary.map(item=>[item.label,String(item.total_tickets),String(item.total_quantity),this.formatAmount(item.total_amount)]),theme:'striped',headStyles:{fillColor:[32,119,150]},styles:{fontSize:9,cellPadding:6}});

			cursorY=(pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY+34;
			pdf.setFont('helvetica','bold');
			pdf.setFontSize(13);
			pdf.text('Resumen por producto',40,cursorY+24);
			autoTable(pdf,{startY:cursorY+34,head:[['Producto','Tickets','Cantidad total','Monto total']],body:arqueo.product_summary.map(item=>[item.label,String(item.total_tickets),String(item.total_quantity),this.formatAmount(item.total_amount)]),theme:'striped',headStyles:{fillColor:[78,145,88]},styles:{fontSize:9,cellPadding:6}});

			cursorY=(pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY+34;
			pdf.setFont('helvetica','bold');
			pdf.setFontSize(13);
			pdf.text('Detalle del arqueo',40,cursorY+24);
			autoTable(pdf,{startY:cursorY+34,head:[this.getDetailHeader()],body:this.getDetailRows(arqueo),theme:'grid',headStyles:{fillColor:[12,59,90]},styles:{fontSize:8,cellPadding:5},columnStyles:{5:{halign:'right'}},margin:{left:32,right:32,bottom:28}});

			pdf.save(`arqueo-${this.getFilePeriodLabel(arqueo)}.pdf`);
			this.notification.success('PDF exportado correctamente.');
		}catch{
			this.notification.error('No se pudo generar el PDF del arqueo.');
		}
	}

	async printArqueo():Promise<void>{
		const arqueo=this.requireCurrentArqueo('imprimir');
		if(!arqueo){
			return;
		}

		const printWindow=window.open('','_blank','width=1200,height=900');
		if(!printWindow){
			this.notification.error('No se pudo abrir la ventana de impresión.');
			return;
		}

		const logoDataUrl=await this.getAssetDataUrl(this.reportLogoUrl);
		printWindow.document.write(this.buildPrintableHtml(arqueo,logoDataUrl));
		printWindow.document.close();
		printWindow.focus();
		printWindow.print();
	}

	private buildDateRangeQuery(startDate:Date|null,endDate:Date|null):{start:string;end:string}{
		const start=this.format(startDate);
		const end=this.format(endDate);
		return start<=end?{start,end}:{start:end,end:start};
	}

	private format(date:Date|null){const d=date??new Date(); return d.toISOString().slice(0,10)}

	getPeriodLabel(arqueo:ArqueoDaily):string{
		if(arqueo.range_applied&&arqueo.start_date&&arqueo.end_date){
			return `${arqueo.start_date} a ${arqueo.end_date}`;
		}
		return arqueo.fecha;
	}

	setTodayRange():void{
		const today=new Date();
		this.startDateControl.setValue(today);
		this.endDateControl.setValue(today);
	}

	setLastSevenDaysRange():void{
		const end=new Date();
		const start=this.addDays(end,-6);
		this.startDateControl.setValue(start);
		this.endDateControl.setValue(end);
	}

	setLastMonthRange():void{
		const end=new Date();
		const start=this.addMonths(end,-1);
		this.startDateControl.setValue(start);
		this.endDateControl.setValue(end);
	}

	onDetailPageChange(event:PageEvent):void{
		this.detailPageIndex=event.pageIndex;
		this.detailPageSize=event.pageSize;
		this.updatePagedDetails();
	}

	private updatePagedDetails(details?:ArqueoDetailItem[]):void{
		const allDetails=details??this.currentArqueo?.details??[];
		const start=this.detailPageIndex*this.detailPageSize;
		if(start>=allDetails.length&&this.detailPageIndex>0){
			this.detailPageIndex=0;
		}
		const sliceStart=this.detailPageIndex*this.detailPageSize;
		this.pagedDetails=allDetails.slice(sliceStart,sliceStart+this.detailPageSize);
	}

	private getFilePeriodLabel(arqueo:ArqueoDaily):string{
		return this.getPeriodLabel(arqueo).replace(/\s+a\s+/g,'-a-').replace(/[^\w-]/g,'-');
	}

	private addDays(date:Date,days:number):Date{
		const copy=new Date(date);
		copy.setDate(copy.getDate()+days);
		return copy;
	}

	private addMonths(date:Date,months:number):Date{
		const copy=new Date(date);
		copy.setMonth(copy.getMonth()+months);
		return copy;
	}

	private formatAmount(value:number):string{
		return `S/ ${value.toFixed(2)}`;
	}

	private requireCurrentArqueo(action:'exportar'|'imprimir'):ArqueoDaily|null{
		if(!this.currentArqueo||!this.currentArqueo.details?.length){
			this.notification.error(`No hay datos de arqueo para ${action}.`);
			return null;
		}
		return this.currentArqueo;
	}

	private getDetailHeader():string[]{
		return ['Ticket','Fecha emision','Receptor','Producto','Cantidad','Monto','Zona','Estado'];
	}

	private getDetailRows(arqueo:ArqueoDaily):string[][]{
		return arqueo.details.map(item=>[item.ticket_number,item.fecha_emision,item.receiver_name,item.product_name,String(item.quantity),this.formatAmount(item.amount),item.zone_name,item.status]);
	}

	private downloadBlob(content:BlobPart,filename:string,type:string):void{
		const blob=new Blob([content],{type});
		const url=URL.createObjectURL(blob);
		const link=document.createElement('a');
		link.href=url;
		link.download=filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	private async getAssetDataUrl(assetPath:string):Promise<string|null>{
		try{
			const response=await fetch(this.resolveAssetUrl(assetPath));
			if(!response.ok){
				return null;
			}
			const blob=await response.blob();
			return await new Promise<string>((resolve,reject)=>{
				const reader=new FileReader();
				reader.onload=()=>resolve(String(reader.result));
				reader.onerror=()=>reject(reader.error);
				reader.readAsDataURL(blob);
			});
		}catch{
			return null;
		}
	}

	private resolveAssetUrl(assetPath:string):string{
		if(/^https?:\/\//i.test(assetPath)){
			return assetPath;
		}
		const normalizedPath=assetPath.startsWith('/')?assetPath:`/${assetPath}`;
		return `${window.location.origin}${normalizedPath}`;
	}

	private paintMetricCard(sheet:ExcelJS.Worksheet,range:string,label:string,value:number,currency:boolean):void{
		sheet.mergeCells(range);
		const cell=sheet.getCell(range.split(':')[0]);
		cell.value=`${label}\n${currency?this.formatAmount(value):value}`;
		cell.alignment={vertical:'middle',horizontal:'left',wrapText:true};
		cell.font={name:'Calibri',size:13,bold:true,color:{argb:'FF163F63'}};
		cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF6FAFD'}};
		cell.border=this.getGridBorder();
	}

	private renderSummarySection(sheet:ExcelJS.Worksheet,startRow:number,title:string,subtitle:string,items:ArqueoSummaryItem[],accentColor:string,entityLabel:string):number{
		sheet.mergeCells(`A${startRow}:F${startRow}`);
		sheet.getCell(`A${startRow}`).value=title;
		sheet.getCell(`A${startRow}`).font={name:'Calibri',size:16,bold:true,color:{argb:'FF17324D'}};
		sheet.mergeCells(`A${startRow+1}:F${startRow+1}`);
		sheet.getCell(`A${startRow+1}`).value=subtitle;
		sheet.getCell(`A${startRow+1}`).font={name:'Calibri',size:10,color:{argb:'FF6E8091'}};

		const headerRow=sheet.getRow(startRow+3);
		headerRow.values=[entityLabel,'Tickets','Cantidad','Monto total'];
		headerRow.eachCell(cell=>{
			cell.font={bold:true,color:{argb:'FFFFFFFF'}};
			cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:accentColor}};
			cell.alignment={vertical:'middle',horizontal:'center'};
			cell.border=this.getGridBorder();
		});

		items.forEach((item,index)=>{
			const row=sheet.getRow(startRow+4+index);
			row.values=[item.label,item.total_tickets,item.total_quantity,this.formatAmount(item.total_amount)];
			row.eachCell((cell,columnNumber)=>{
				cell.border=this.getGridBorder();
				cell.alignment={vertical:'middle',horizontal:columnNumber===1?'left':'center'};
			});
		});

		return startRow+4+items.length;
	}

	private renderDetailSection(sheet:ExcelJS.Worksheet,startRow:number,arqueo:ArqueoDaily):void{
		sheet.mergeCells(`A${startRow}:H${startRow}`);
		sheet.getCell(`A${startRow}`).value='Detalle del arqueo';
		sheet.getCell(`A${startRow}`).font={name:'Calibri',size:16,bold:true,color:{argb:'FF17324D'}};
		sheet.mergeCells(`A${startRow+1}:H${startRow+1}`);
		sheet.getCell(`A${startRow+1}`).value='Detalle completo de tickets emitidos, producto, cantidad, zona y estado.';
		sheet.getCell(`A${startRow+1}`).font={name:'Calibri',size:10,color:{argb:'FF6E8091'}};

		const headerRow=sheet.getRow(startRow+3);
		headerRow.values=this.getDetailHeader();
		headerRow.eachCell(cell=>{
			cell.font={bold:true,color:{argb:'FFFFFFFF'}};
			cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0C3B5A'}};
			cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
			cell.border=this.getGridBorder();
		});

		arqueo.details.forEach((item,index)=>{
			const row=sheet.getRow(startRow+4+index);
			row.values=[item.ticket_number,item.fecha_emision,item.receiver_name,item.product_name,item.quantity,this.formatAmount(item.amount),item.zone_name,item.status];
			row.eachCell((cell,columnNumber)=>{
				cell.border=this.getGridBorder();
				cell.alignment={vertical:'middle',horizontal:(columnNumber===5||columnNumber===6||columnNumber===8)?'center':'left',wrapText:true};
			});
			row.getCell(8).fill={type:'pattern',pattern:'solid',fgColor:{argb:this.getStatusFill(item.status)}};
			row.getCell(8).font={bold:true,color:{argb:this.getStatusText(item.status)}};
		});
	}

	private getGridBorder():Partial<ExcelJS.Borders>{
		return {top:{style:'thin',color:{argb:'FFD9E4EC'}},left:{style:'thin',color:{argb:'FFD9E4EC'}},bottom:{style:'thin',color:{argb:'FFD9E4EC'}},right:{style:'thin',color:{argb:'FFD9E4EC'}}};
	}

	private getStatusFill(status:string):string{
		if(status==='SYNCED'){
			return 'FFE4F4E8';
		}
		if(status==='PENDING'){
			return 'FFFFF1D6';
		}
		return 'FFFCE3E3';
	}

	private getStatusText(status:string):string{
		if(status==='SYNCED'){
			return 'FF1D7A43';
		}
		if(status==='PENDING'){
			return 'FF9C6A00';
		}
		return 'FFB13232';
	}

	private buildPrintableHtml(arqueo:ArqueoDaily,logoDataUrl:string|null):string{
		const summaryCards=[{label:'Tickets',value:String(arqueo.total_tickets)},{label:'Abastecimientos',value:String(arqueo.total_abastecimientos)},{label:'Monto total',value:this.formatAmount(arqueo.total_monto)},{label:'Registros detalle',value:String(arqueo.details.length)}].map(item=>`<div class="summary-card"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('');
		const zoneRows=this.buildSummaryTableRows(arqueo.zone_summary);
		const productRows=this.buildSummaryTableRows(arqueo.product_summary);
		const detailRows=arqueo.details.map(item=>this.buildDetailTableRow(item)).join('');

		return `
			<html>
			<head>
				<title>Arqueo ${this.escapeHtml(this.getPeriodLabel(arqueo))}</title>
				<style>
					* { box-sizing: border-box; }
					body { margin: 0; font-family: Arial, sans-serif; color: #17324d; background: #eef4f8; }
					.report-shell { padding: 30px; }
					.report-card { background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(12, 59, 90, 0.12); }
					.report-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 32px; background: linear-gradient(135deg, #0c3b5a, #176287); color: #ffffff; }
					.brand-block { display: flex; align-items: center; gap: 18px; }
					.brand-block img { width: 138px; max-height: 76px; object-fit: contain; background: rgba(255,255,255,0.14); border-radius: 16px; padding: 10px 14px; }
					.brand-copy h1 { margin: 0 0 6px; font-size: 28px; }
					.brand-copy p { margin: 0; opacity: 0.9; }
					.report-date { text-align: right; font-size: 13px; opacity: 0.92; }
					.report-body { padding: 26px 32px 32px; }
					.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
					.summary-card { border: 1px solid #d9e5ef; border-radius: 18px; padding: 16px; background: linear-gradient(180deg, #f8fbfd, #eef5f9); }
					.summary-card span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #537089; margin-bottom: 8px; }
					.summary-card strong { font-size: 22px; }
					.section { margin-top: 24px; }
					.section h2 { margin: 0 0 6px; font-size: 18px; }
					.section p { margin: 0 0 12px; color: #61798e; font-size: 13px; }
					table { width: 100%; border-collapse: collapse; }
					th, td { padding: 10px 12px; border-bottom: 1px solid #e0e8ef; text-align: left; font-size: 12px; }
					th { background: #edf4f8; color: #23415a; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
					.status-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
					.status-SYNCED { background: #e2f4e8; color: #1e7d45; }
					.status-PENDING { background: #fff2d8; color: #9a6a00; }
					.status-FAILED { background: #fde4e4; color: #b13232; }
					@media print { body { background: #ffffff; } .report-shell { padding: 0; } .report-card { box-shadow: none; border-radius: 0; } }
				</style>
			</head>
			<body>
				<div class="report-shell">
					<div class="report-card">
						<div class="report-header">
							<div class="brand-block">
								${logoDataUrl ? `<img src="${logoDataUrl}" alt="SEMAPAM" />` : ''}
								<div class="brand-copy">
									<h1>Arqueo diario</h1>
									<p>${this.escapeHtml(this.branding.organizationName)} · Reporte consolidado operativo</p>
								</div>
							</div>
							<div class="report-date"><div>Periodo consultado</div><strong>${this.escapeHtml(this.getPeriodLabel(arqueo))}</strong></div>
						</div>
						<div class="report-body">
							<div class="summary-grid">${summaryCards}</div>
							<div class="section"><h2>Resumen por zona</h2><p>Agrupación consolidada a partir del detalle diario.</p><table><thead><tr><th>Zona</th><th>Tickets</th><th>Cantidad</th><th>Monto total</th></tr></thead><tbody>${zoneRows}</tbody></table></div>
							<div class="section"><h2>Resumen por producto</h2><p>Cantidad despachada y monto por producto.</p><table><thead><tr><th>Producto</th><th>Tickets</th><th>Cantidad</th><th>Monto total</th></tr></thead><tbody>${productRows}</tbody></table></div>
							<div class="section"><h2>Detalle del arqueo</h2><p>Detalle completo de tickets emitidos, producto, cantidad, zona y estado.</p><table><thead><tr><th>Ticket</th><th>Fecha emisión</th><th>Receptor</th><th>Producto</th><th>Cantidad</th><th>Monto</th><th>Zona</th><th>Estado</th></tr></thead><tbody>${detailRows}</tbody></table></div>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	private buildSummaryTableRows(items:ArqueoSummaryItem[]):string{
		return items.map(item=>`<tr><td>${this.escapeHtml(item.label)}</td><td>${item.total_tickets}</td><td>${item.total_quantity}</td><td>${this.formatAmount(item.total_amount)}</td></tr>`).join('');
	}

	private buildDetailTableRow(item:ArqueoDetailItem):string{
		const statusClass=`status-${this.escapeHtml(item.status)}`;
		return `<tr><td>${this.escapeHtml(item.ticket_number)}</td><td>${this.escapeHtml(item.fecha_emision)}</td><td>${this.escapeHtml(item.receiver_name)}</td><td>${this.escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>${this.formatAmount(item.amount)}</td><td>${this.escapeHtml(item.zone_name)}</td><td><span class="status-pill ${statusClass}">${this.escapeHtml(item.status)}</span></td></tr>`;
	}

	private escapeHtml(value:string):string{
		return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
	}
}
